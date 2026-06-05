import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { 
  BookOpen, 
  Settings, 
  CheckCircle2, 
  Download, 
  Loader2, 
  ChevronRight, 
  ChevronLeft,
  Plus,
  Trash2,
  FileSpreadsheet,
  Image as ImageIcon,
  AlertCircle,
  Wand2,
  X,
  RefreshCw,
  Eye,
  Copy
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import MissionBookPreview from './missionBook/MissionBookPreview';

// Repair JSON that contains bare backslashes from stray LaTeX (\frac, \times, etc.).
// Replaces any backslash NOT followed by a valid JSON escape char with a doubled one.
function repairJson(s: string): string {
  return s.replace(/\\(?!["\\/bfnrtu])/g, "\\\\");
}

function parseLooseJson<T = any>(s: string): T {
  try {
    return JSON.parse(s);
  } catch (e) {
    const repaired = repairJson(s);
    return JSON.parse(repaired) as T;
  }
}

async function callApi<T>(endpoint: string, body: any): Promise<T> {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  let data: any;
  try {
    data = await res.json();
  } catch {
    data = {};
  }
  if (!res.ok) {
    throw new Error(data?.error || `Request to ${endpoint} failed (${res.status})`);
  }
  return data as T;
}

const QUESTION_BATCH_SIZE = 5;

function splitBalanced(total: number, maxBatchSize: number): number[] {
  if (total <= 0) return [];
  const numBatches = Math.ceil(total / maxBatchSize);
  const base = Math.floor(total / numBatches);
  const extras = total - base * numBatches;
  return Array.from({ length: numBatches }, (_, i) => base + (i < extras ? 1 : 0));
}

function allocateDifficulty(
  batchSizes: number[],
  easy: number,
  medium: number,
  hard: number
): { easy: number; medium: number; hard: number }[] {
  const flat: ("easy" | "medium" | "hard")[] = [];
  let e = easy, m = medium, h = hard;
  while (e + m + h > 0) {
    if (e > 0) { flat.push("easy"); e--; }
    if (m > 0) { flat.push("medium"); m--; }
    if (h > 0) { flat.push("hard"); h--; }
  }
  const result = batchSizes.map(() => ({ easy: 0, medium: 0, hard: 0 }));
  let cursor = 0;
  for (let b = 0; b < batchSizes.length; b++) {
    for (let j = 0; j < batchSizes[b]; j++) {
      const d = flat[cursor];
      if (d) result[b][d]++;
      cursor++;
    }
  }
  return result;
}

/**
 * Round-robin allocate target skills to batches so each batch has a clear
 * focus subset. If there are fewer skills than batches, the leftover batches
 * fall back to the full skill list rather than being skill-less.
 */
function distributeSkills(skills: string[], numBatches: number): string[][] {
  if (numBatches <= 0) return [];
  if (skills.length === 0) return Array.from({ length: numBatches }, () => []);
  const buckets: string[][] = Array.from({ length: numBatches }, () => []);
  skills.forEach((s, i) => buckets[i % numBatches].push(s));
  for (let i = 0; i < numBatches; i++) {
    if (buckets[i].length === 0) buckets[i] = [...skills];
  }
  return buckets;
}

function distributeImages(batchSizes: number[], totalImages: number): number[] {
  const sumBatches = batchSizes.reduce((a, b) => a + b, 0);
  if (sumBatches === 0) return batchSizes.map(() => 0);
  const result = new Array(batchSizes.length).fill(0);
  const fractions: { idx: number; frac: number }[] = [];
  let remaining = totalImages;
  for (let i = 0; i < batchSizes.length; i++) {
    const ideal = (batchSizes[i] / sumBatches) * totalImages;
    const floored = Math.floor(ideal);
    result[i] = floored;
    remaining -= floored;
    fractions.push({ idx: i, frac: ideal - floored });
  }
  fractions.sort((a, b) => b.frac - a.frac);
  for (let i = 0; i < remaining && fractions.length > 0; i++) {
    result[fractions[i % fractions.length].idx]++;
  }
  for (let i = 0; i < result.length; i++) {
    if (result[i] > batchSizes[i]) result[i] = batchSizes[i];
  }
  return result;
}

interface Question {
  Q_No: number;
  Question_Type: string;
  Difficulty: string;
  Question_Text: string;
  Option_A?: string;
  Option_B?: string;
  Option_C?: string;
  Option_D?: string;
  Correct_Answer: string;
  Has_Image: string;
  Image_Filename?: string;
  Image_Description: string;
  Image_Prompt?: string;
  Skill_Mapped: string;
  LO_Code: string;
  NCERT_Reference: string;
  Marks: number;
  Hint?: string;
  ImageData?: string;
  Layout_Hint?: "narrow" | "normal" | "wide" | "table" | "image-block";
  Template?: string;
  /** Internal flag — true if Skill_Mapped matches one of the target skills. */
  __skillOk?: boolean;
}

interface ReferenceFile {
  name: string;
  data: string; // base64
  mimeType: string;
}

interface Config {
  learningOutcome: string;
  skills: string[];
  excludedSkills: string[];
  gradeLevel: string;
  subject: string;
  language: string;
  totalQuestions: number;
  difficultySplit: {
    easy: number;
    medium: number;
    hard: number;
  };
  imagePercentage: number;
  imageSize: '1K' | '2K' | '4K';
  additionalRequirements?: string;
  referenceFiles: ReferenceFile[];
}

export default function App() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [ncertRef, setNcertRef] = useState("");
  const [status, setStatus] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editPrompt, setEditPrompt] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [recreatingIndex, setRecreatingIndex] = useState<number | null>(null);
  const [showPromptIndex, setShowPromptIndex] = useState<number | null>(null);
  const [solvedExample, setSolvedExample] = useState<{
    problem: string;
    explanation: string;
    answer: string;
  } | null>(null);
  const [missionBookLoading, setMissionBookLoading] = useState(false);
  const [missionBookOpen, setMissionBookOpen] = useState(false);
  const [monsterName, setMonsterName] = useState("");
  const [monsterImageData, setMonsterImageData] = useState<string | null>(null);
  const [monsterImageName, setMonsterImageName] = useState<string>("");
  const [monsterProcessing, setMonsterProcessing] = useState(false);
  const [missionBookFeedback, setMissionBookFeedback] = useState<string | null>(null);

  const [config, setConfig] = useState<Config>({
    learningOutcome: "",
    skills: [""],
    excludedSkills: [""],
    gradeLevel: "7",
    subject: "Mathematics",
    language: "English (UK)",
    totalQuestions: 15,
    difficultySplit: {
      easy: 5,
      medium: 7,
      hard: 3
    },
    imagePercentage: 40,
    imageSize: '1K',
    additionalRequirements: "",
    referenceFiles: []
  });

  const handleReset = () => {
    setConfig({
      learningOutcome: "",
      skills: [""],
      excludedSkills: [""],
      gradeLevel: "7",
      subject: "Mathematics",
      language: "English (UK)",
      totalQuestions: 15,
      difficultySplit: {
        easy: 5,
        medium: 7,
        hard: 3
      },
      imagePercentage: 40,
      imageSize: '1K',
      additionalRequirements: "",
      referenceFiles: []
    });
    setQuestions([]);
    setStep(1);
    setNcertRef("");
    setError(null);
    setSolvedExample(null);
  };

  const handleAddSkill = () => {
    setConfig(prev => ({ ...prev, skills: [...prev.skills, ""] }));
  };

  const handleRemoveSkill = (index: number) => {
    setConfig(prev => ({ ...prev, skills: prev.skills.filter((_, i) => i !== index) }));
  };

  const handleSkillChange = (index: number, value: string) => {
    const newSkills = [...config.skills];
    newSkills[index] = value;
    setConfig(prev => ({ ...prev, skills: newSkills }));
  };

  const validateStep1 = () => {
    return config.learningOutcome && config.skills.some(s => s.trim() !== "") && config.subject;
  };

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setStatus("Analyzing reference materials...");
    try {
      const referenceParts = config.referenceFiles.map(file => ({
        inlineData: {
          data: file.data,
          mimeType: file.mimeType
        }
      }));

      // Strip empty rows once, then reuse everywhere — keeps prompts clean.
      const cleanedSkills = config.skills.map(s => s.trim()).filter(Boolean);
      const cleanedExcludedSkills = config.excludedSkills
        .map(s => s.trim())
        .filter(Boolean);
      const excludedClause = cleanedExcludedSkills.length > 0
        ? `Excluded Skills (CRITICAL: DO NOT CREATE QUESTIONS ON THESE): ${cleanedExcludedSkills.join(", ")}`
        : "";

      // 1. Validate against NCERT (Search Grounding + Reference Files)
      let ncertReference = "NCERT Alignment Confirmed";
      try {
        const validationPrompt = `
          Validate the following Learning Outcome and Skills against the NCERT curriculum for Grade ${config.gradeLevel} ${config.subject}.
          LO: ${config.learningOutcome}
          Target Skills: ${cleanedSkills.join(", ")}
          ${cleanedExcludedSkills.length > 0 ? `Excluded Skills (DO NOT USE THESE): ${cleanedExcludedSkills.join(", ")}` : ""}
          ${config.referenceFiles.length > 0 ? `I have uploaded ${config.referenceFiles.length} reference chapter PDF(s). Please prioritize the content, terminology, and diagram styles found in these PDFs.` : ""}
          
          Confirm if these are accurate for the NCERT curriculum. If there are slight deviations, suggest the correct NCERT chapter and topic.
          Provide a concise confirmation and the exact NCERT reference (Chapter Name, Topic).
        `;

        const validationResponse = await callApi<{ text: string }>("/api/validate-ncert", {
          prompt: validationPrompt,
          referenceParts,
        });
        ncertReference = validationResponse.text || ncertReference;
      } catch (err) {
        console.warn("NCERT Validation failed, proceeding with default reference:", err);
      }

      // 2. Generate Questions (in parallel batches to stay under per-function timeout)
      const requiredImageCount = Math.round(config.totalQuestions * config.imagePercentage / 100);
      const batchSizes = splitBalanced(config.totalQuestions, QUESTION_BATCH_SIZE);
      const diffPerBatch = allocateDifficulty(
        batchSizes,
        config.difficultySplit.easy,
        config.difficultySplit.medium,
        config.difficultySplit.hard
      );
      const imagesPerBatch = distributeImages(batchSizes, requiredImageCount);
      const skillsPerBatch = distributeSkills(cleanedSkills, batchSizes.length);

      const buildBatchPrompt = (
        batchSize: number,
        diff: { easy: number; medium: number; hard: number },
        batchImageCount: number,
        isLastBatch: boolean,
        focusSkills: string[]
      ) => `
        You are an expert NCERT question paper setter. Generate exactly ${batchSize} NOVEL and UNIQUE questions for:
        Grade: ${config.gradeLevel}
        Subject: ${config.subject}
        Language: ${config.language} (STRICTLY USE UK ENGLISH SPELLING, GRAMMAR, AND VOCABULARY. E.g., colour, centre, maths)
        LO: ${config.learningOutcome}
        Overall Target Skills (the WORKSHEET as a whole must cover all of these): ${cleanedSkills.join(", ")}
        FOCUS SKILLS FOR THIS BATCH (every question here must primarily exercise one of these): ${focusSkills.join(", ")}
        ${excludedClause}
        NCERT Reference: ${ncertReference}
        Difficulty Split: Easy: ${diff.easy}, Medium: ${diff.medium}, Hard: ${diff.hard}

        SKILL COVERAGE (MANDATORY):
        - EVERY focus skill listed above MUST appear as the Skill_Mapped of at least one question in this batch. No skill may be left uncovered.
        - If there are more focus skills than questions, combine closely related skills into a single question that exercises both — but still set Skill_Mapped to the primary one and mention the secondary in a Hint.
        - Spread questions evenly across focus skills. Do not give the majority of questions to one skill.
        - Vary the contexts and scenarios so similar skills don't reuse the same setup.
        - Set Skill_Mapped to the EXACT focus-skill string the question targets — copy it verbatim from the list above. Do not paraphrase or invent your own skill names.

        CRITICAL QUALITY STANDARDS:
        1. DO NOT repeat standard examples. Generate fresh, highly diverse scenarios and contexts for each question.
        2. Ensure the rigor matches NCERT textbook EXERCISES and EXEMPLAR problems. Focus on conceptual understanding, application, and critical thinking rather than simple recall.
        3. Make sure the difficulty levels accurately reflect the cognitive load expected at this grade level.
        4. KEEP QUESTION STEMS SHORT AND SIMPLE. Use plain, direct language a Grade ${config.gradeLevel} student can parse in one read. Avoid wordy setups — get to the point quickly.

        QUESTION STEM PHRASING (MANDATORY): Word every Question_Text in the classic NCERT teacher-worksheet instructional style. Begin the stem with a direct imperative that matches the task, e.g.:
        - Definitions / terms: "Define ...", "Define the term ...", "What is meant by ...?"
        - Reasoning / justification: "Give a reason: ...", "Why ...?", "Explain why ..."
        - True/False statements: "State true or false: ..."
        - Fill in the blanks: "Fill in the blank: ..." (keep the blank "______" inline in the stem)
        - Identification: "Identify ...", "Name ..."
        - Short answer: "Answer the following: ...", "What are ...?", "List ..."
        Do NOT use vague openers like "Consider the following" or "Which of these". Phrase the stem as a teacher would write it on a worksheet.

        ${config.additionalRequirements ? `ADDITIONAL USER REQUIREMENTS: ${config.additionalRequirements}` : ""}

        ${config.referenceFiles.length > 0 ? "CRITICAL: Use the uploaded PDFs as the primary source for question context, numerical values, and diagram types. Ensure the questions match the pedagogical style of these specific chapters." : ""}

        Question Type Library to use: MCQ, FIB, MATCH, ARR.
        - MCQ: Multiple Choice Question
        - FIB: Fill in the Blanks
        - MATCH: Match the Following (Properly formatted)
        - ARR: Arranging in order. THESE MUST BE FORMATTED AS MCQ. List the items or steps using Roman numerals (I, II, III, etc.) within the Question_Text. The options (Option_A to Option_D) must provide 4 different logical sequences of these numerals (e.g., "A) II, V, III, IV, I").

        Example ARR format:
        Question_Text: "Arrange the steps in the correct logical order... (I) Step 1 (II) Step 2..."
        Option_A: "II, I, III..."
        Option_B: "I, II, III..."
        ...and so on.

        ${isLastBatch ? `STRICT REQUIREMENT: The VERY LAST question (Q_No: ${batchSize}) MUST be a "HOTS" (Higher Order Thinking Skills) question. This HOTS question must be a combination of 2-3 of the target skills provided. Label its Question_Type as "HOTS".` : ""}

        Use a diverse mix of MCQ, FIB, MATCH, and ARR.

        MATH FORMATTING:
        - Write fractions as plain numerator/denominator: "1/2", "3/4", "11/5". A post-processor will render them as proper fractions.
        - Write mixed fractions with a space: "2 1/5", "5 1/2".
        - Use Unicode operators in plain text: × for multiplication, ÷ for division, ° for degrees, ² for squared.
        - DO NOT use LaTeX commands (no \\frac, no \\times, no $) in the JSON output — they would break the JSON.

        STRICT IMAGE REQUIREMENT: Exactly ${batchImageCount} out of ${batchSize} questions MUST have Has_Image: "Yes".
        Any question type (MCQ, FIB, MATCH, ARR, HOTS) can be an image-based question.

        Number these questions Q_No 1 through ${batchSize}. They will be re-numbered as part of a larger set, so DO NOT cross-reference other question numbers.

        Return a JSON array of objects with these fields:
        Q_No, Question_Type, Difficulty, Question_Text, Option_A, Option_B, Option_C, Option_D, Correct_Answer, Has_Image, Image_Description, Image_Prompt, Skill_Mapped, LO_Code, NCERT_Reference, Marks, Hint, Template.

        For Has_Image: "Yes" or "No".

        For Template, pick EXACTLY ONE name from the catalog below based on the question's visual structure. The renderer dispatches on this. Pick the most specific template that fits; don't default to "mcq-text-wide" if a better match exists.

          MCQ family (stem + 4 options a/b/c/d):
            - mcq-text-narrow      : very short stem AND all options ≤ 20 chars, no image
            - mcq-text-half        : standard MCQ, short stem, no image (most common)
            - mcq-text-wide        : long stem or long options, no image
            - mcq-with-figure      : MCQ that has a figure/diagram alongside the stem
            - mcq-image-options    : the 4 OPTIONS themselves are pictures (a/b/c/d are images)
            - mcq-true-false       : TRUE/FALSE or Yes/No selection
          Sequence & match:
            - arrange-sequence     : "Arrange the steps in correct order", Roman-numeral steps (I)/(II)/(III)/(IV)
            - match-list-pair      : Match the following — Column I items pair with Column II items; student draws lines. Use this for ALL match-the-following questions.
          Fill-in-blank family:
            - fib-single           : one inline blank in the stem
            - fib-multi-indent     : multiple a/b/c/d sub-blanks shown as indented text
            - fib-multi-pill       : multiple a/b/c/d sub-questions shown as pill-shaped boxes
          Image-driven:
            - image-grid-identify  : "Name these..." with multiple labeled images in a grid
            - image-with-blanks    : one big image with parts to label
            - figure-question      : word problem with a single figure, open-ended answer
            - figure-question-multipart : multiple labeled figures a/b/c side-by-side
          Special:
            - vertical-clue-list   : letter-badged clues ("A: I am ...", "B: ...", "C: ...")
            - compare-groups       : "Group A vs Group B" comparison
            - word-search          : stem + letter grid puzzle
            - hots-text            : HOTS question (use this for the LAST question only)

        IMPORTANT for match-the-following questions: format the stem as
          "<lead text>. Column I (a) item1 (b) item2 (c) item3 (d) item4 Column II (i) value1 (ii) value2 (iii) value3 (iv) value4"
        — use Column I and Column II as section headers, each item labeled with a parenthesized letter or roman, separated by spaces. Do NOT provide MCQ-style answer options (Option_A..D should be empty for match-list-pair). The student draws the match lines manually.
        For Image_Description: Provide a detailed, unambiguous description for an image generation system. If it is a mathematical diagram, specify exactly how many items, ticks, or jumps are needed.
        For Image_Prompt: Construct a specific prompt for this image following this EXACT template:
        "Create a clean, precise NCERT-style educational diagram for [concept/topic]. Illustrate the key elements exactly as described: [extremely specific details: e.g., 'a number line with exactly 10 tick marks, showing exactly 4 distinct arcs where each arc spans exactly 3 tick marks']. The visual must be mathematically accurate. Include text labels, letters, or captions ONLY when they are essential for the student to understand the diagram (e.g., vertex labels A, B, C on a geometry figure, axis labels, units). Avoid decorative or redundant text. Keep a plain white background. Use clean vector style."

        ${config.referenceFiles.length > 0 ? "If the question is based on a diagram in the PDFs, describe that specific diagram accurately in the Image_Description and Image_Prompt." : ""}
      `;

      const solvedExamplePrompt = `
        You are an NCERT teacher. Produce ONE solved example for:
        Grade: ${config.gradeLevel}, Subject: ${config.subject}, LO: ${config.learningOutcome}
        Skills: ${config.skills.filter(s => s.trim()).join(", ")}.
        NCERT Reference: ${ncertReference}.

        Return JSON: { "problem": string, "explanation": string, "answer": string }.
        - "problem" is a single-paragraph word problem at Medium difficulty.
        - "explanation" is 3-6 short numbered steps as one string with line breaks.
        - "answer" is the final answer in 1-2 words or a short phrase.
      `;
      const solvedExamplePromise = callApi<{ text: string }>(
        "/api/generate-solved-example",
        { prompt: solvedExamplePrompt, referenceParts }
      ).catch((err) => {
        console.warn("Solved example generation failed:", err);
        return null;
      });

      setStatus(`Generating questions (0/${batchSizes.length})...`);
      let completedBatches = 0;
      const batchResults = await Promise.all(
        batchSizes.map(async (size, idx) => {
          const isLastBatch = idx === batchSizes.length - 1;
          const prompt = buildBatchPrompt(
            size,
            diffPerBatch[idx],
            imagesPerBatch[idx],
            isLastBatch,
            skillsPerBatch[idx] ?? cleanedSkills
          );
          const resp = await callApi<{ text: string }>("/api/generate-questions", {
            prompt,
            referenceParts,
          });
          completedBatches++;
          setStatus(`Generating questions (${completedBatches}/${batchSizes.length})...`);
          return parseLooseJson<any[]>(resp.text || "[]");
        })
      );

      const generatedQuestions = batchResults.flat();
      generatedQuestions.forEach((q, i) => { q.Q_No = i + 1; });

      // Validate Skill_Mapped against the target list. The LLM occasionally
      // invents skill names that don't match anything the user asked for.
      // We don't reject the question — just flag it so the UI can colour
      // the skill chip and tell the user something looks off.
      if (cleanedSkills.length > 0) {
        const lc = (s: string) => (s || "").trim().toLowerCase();
        const targetLc = cleanedSkills.map(lc);
        let mismatchCount = 0;
        generatedQuestions.forEach((q: any) => {
          const mapped = lc(q.Skill_Mapped || "");
          // Treat as a match if the LLM's string equals OR is contained
          // by any target skill (and vice versa) — catches paraphrases like
          // "Identify alternate angles" vs "Identify alternate interior angles".
          const ok =
            mapped.length > 0 &&
            targetLc.some(t => t === mapped || t.includes(mapped) || mapped.includes(t));
          q.__skillOk = ok;
          if (!ok) mismatchCount++;
        });
        if (mismatchCount > 0) {
          console.warn(
            `[handleGenerate] ${mismatchCount}/${generatedQuestions.length} questions have a Skill_Mapped that doesn't match any target skill.`
          );
        }

        // Check that every target skill got at least one question.
        const coveredSkills = new Set(
          generatedQuestions
            .filter((q: any) => q.__skillOk)
            .map((q: any) => targetLc.find(t => {
              const m = lc(q.Skill_Mapped || "");
              return t === m || t.includes(m) || m.includes(t);
            }))
            .filter(Boolean)
        );
        const missingSkills = cleanedSkills.filter((_, i) => !coveredSkills.has(targetLc[i]));
        if (missingSkills.length > 0) {
          console.warn(`[handleGenerate] Skills with NO questions: ${missingSkills.join(", ")}`);
          setError(`Warning: These skills got no questions — ${missingSkills.join(", ")}. Consider regenerating.`);
        }
      }

      setNcertRef(ncertReference);

      const solvedExampleResp = await solvedExamplePromise;
      if (solvedExampleResp?.text) {
        try {
          const parsed = parseLooseJson<any>(solvedExampleResp.text);
          if (parsed && typeof parsed.problem === "string") {
            setSolvedExample({
              problem: parsed.problem || "",
              explanation: parsed.explanation || "",
              answer: parsed.answer || "",
            });
          }
        } catch (e) {
          console.warn("Failed to parse solved example JSON:", e);
        }
      }

      setStatus("Generating images...");
      // 3. Generate Images
      const questionsWithImages = await Promise.all(generatedQuestions.map(async (q: any) => {
        if (q.Has_Image === "Yes") {
          try {
            const imageResponse = await callApi<{ imageData: string }>("/api/generate-image", {
              prompt: q.Image_Prompt || `Vibrant, colorful educational illustration: ${q.Image_Description}.
                    STYLE: Clean flat design vector, thick outlines, solid white background.
                    Include text labels (e.g., vertex letters, axis labels, units) ONLY when essential for understanding. NO ANSWERS or solutions on the image. NO CHARACTERS (no mascots, owls, or people).`,
              imageSize: config.imageSize,
            });
            if (imageResponse.imageData) {
              q.ImageData = imageResponse.imageData;
              q.Image_Filename = `Q${q.Q_No}.png`;
            } else {
              q.Has_Image = "No";
            }
          } catch (err) {
            console.error(`Failed to generate image for Q${q.Q_No}:`, err);
            q.Has_Image = "No";
          }
        }
        return q;
      }));

      setQuestions(questionsWithImages);
      setStep(3);
    } catch (err: any) {
      console.error("Generation Error:", err);
      let message = err.message;
      if (message?.includes("API key not valid") || message?.includes("API_KEY_INVALID")) {
        message = "All Gemini API keys failed. Verify the GEMINI_API_KEYS environment variable on Vercel is set to a comma-separated list of valid keys.";
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const downloadZip = async () => {
    const zip = new JSZip();
    
    // 1. Create Excel
    const worksheetData = questions.map(q => {
      const { ImageData, ...rest } = q;
      return rest;
    });
    const ws = XLSX.utils.json_to_sheet(worksheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Questions");
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    zip.file("questions.xlsx", excelBuffer);

    // 2. Add Images
    const imgFolder = zip.folder("images");
    if (imgFolder) {
      questions.forEach(q => {
        if (q.Has_Image === "Yes" && q.ImageData && q.Image_Filename) {
          imgFolder.file(q.Image_Filename, q.ImageData, { base64: true });
        }
      });
    }

    const content = await zip.generateAsync({ type: "blob" });
    saveAs(content, "ncert_worksheet.zip");
  };

  const handleMonsterImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Monster image must be a PNG/JPEG file.");
      return;
    }

    const readAsDataUrl = (f: File) =>
      new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result as string);
        r.onerror = () => reject(new Error("Failed to read monster image."));
        r.readAsDataURL(f);
      });

    try {
      setMonsterProcessing(true);
      setError(null);
      const originalDataUrl = await readAsDataUrl(file);
      setMonsterImageName(file.name);
      // Show original immediately so the user has feedback while bg removal runs.
      setMonsterImageData(originalDataUrl);

      const { removeBackground } = await import("./missionBook/bgRemoval");
      const transparentDataUrl = await removeBackground(originalDataUrl);
      if (transparentDataUrl) {
        setMonsterImageData(transparentDataUrl);
      } else {
        console.warn("Background removal returned no data; keeping original.");
      }
    } catch (err: any) {
      console.warn("Monster background removal failed; keeping original:", err);
    } finally {
      setMonsterProcessing(false);
    }
  };

  const countPdfPages = async (blob: Blob): Promise<number> => {
    try {
      const pdfjs: any = await import("pdfjs-dist");
      try {
        pdfjs.GlobalWorkerOptions.workerSrc = (
          await import("pdfjs-dist/build/pdf.worker.min.mjs?url" as any)
        ).default;
      } catch { /* worker URL not critical for getDocument metadata */ }
      const buf = await blob.arrayBuffer();
      const doc = await pdfjs.getDocument({ data: buf }).promise;
      return doc.numPages;
    } catch (e) {
      console.warn("Page count failed:", e);
      return 0;
    }
  };

  const downloadMissionBook = async () => {
    if (questions.length === 0) {
      setError("Generate questions first.");
      return;
    }
    if (questions.length < 10) {
      setError(`Mission Book needs at least 10 questions (you have ${questions.length}). Regenerate with 10–15.`);
      return;
    }
    setMissionBookFeedback(null);
    setError(null);
    setMissionBookOpen(true);
  };

  // legacy direct-PDF path retained for reference; not wired into the UI.
  const _legacyDirectPdfBuild = async () => {
    setMissionBookLoading(true);
    setMissionBookFeedback(null);
    try {
      const { buildMissionBook } = await import("./missionBook/buildMissionBook");
      const rawLO = (config.learningOutcome || "").trim();
      const loPrefixMatch = rawLO.match(/^([A-Z0-9_-]+)\s*[—–-]\s*/i);
      const loCode = loPrefixMatch ? loPrefixMatch[1] : "";
      const cleanedLO = rawLO.replace(/^[A-Z0-9_-]+\s*[—–-]\s*/i, "").trim();
      const lessonTitle = cleanedLO || rawLO || "Mission Book";
      const lessonCode = `L${config.gradeLevel}`;
      const subjectShort =
        config.subject.length > 12 ? config.subject.slice(0, 12) : config.subject;

      const monsterOverride =
        monsterName.trim() || monsterImageData
          ? { name: monsterName.trim() || undefined, asset: monsterImageData || undefined }
          : undefined;

      console.log("[downloadMissionBook] questions:", questions.length, "withImages:", questions.filter(q => q.Has_Image === "Yes" && q.ImageData).length);
      const { blob, pack } = await buildMissionBook({
        gradeLevel: config.gradeLevel,
        subject: subjectShort,
        lessonTitle,
        lessonCode,
        loCode,
        monsterOverride,
        solvedExample,
        questions: questions.map(q => ({
          Q_No: q.Q_No,
          Question_Type: q.Question_Type,
          Question_Text: q.Question_Text,
          Option_A: q.Option_A,
          Option_B: q.Option_B,
          Option_C: q.Option_C,
          Option_D: q.Option_D,
          Has_Image: q.Has_Image,
          ImageData: q.ImageData,
          Layout_Hint: q.Layout_Hint,
        } as any)),
      });

      const pages = await countPdfPages(blob);
      const packedCount = pack.pages.length;
      if (pack.overflow) {
        setMissionBookFeedback(
          `Packer overflowed: ${questions.length} questions cannot fit in 2 A4 pages. Reduce the question count or shorten content.`
        );
      } else if (pages > 2) {
        setMissionBookFeedback(
          `Generated ${pages} pages — exceeded the 2-page target (packer estimated ${packedCount}). Reduce questions.`
        );
      } else if (pages === 2) {
        setMissionBookFeedback("Mission Book PDF: 2 pages ✓");
      } else if (pages > 0) {
        setMissionBookFeedback(`Mission Book PDF: ${pages} page${pages === 1 ? "" : "s"}.`);
      }
      saveAs(blob, "mission_book.pdf");
    } catch (err: any) {
      console.error("[downloadMissionBook] ERROR:", err);
      const detail =
        err?.name && err?.message
          ? `${err.name}: ${err.message}`
          : (err?.message || "Unknown error");
      setError("Failed to build Mission Book PDF: " + detail);
    } finally {
      setMissionBookLoading(false);
    }
  };

  const handleEditImage = async () => {
    if (editingIndex === null || !editPrompt) return;
    setEditLoading(true);
    try {
      const q = questions[editingIndex];
      const strictRules = "\n\nSTRICT RULES: Maintain clean flat design vector style with thick outlines on solid white background. NO TEXT, NO ANSWERS, NO CHARACTERS. Only minimal necessary labels (A, B, units).";
      const response = await callApi<{ imageData: string }>("/api/edit-image", {
        prompt: editPrompt + strictRules,
        imageData: q.ImageData!,
        mimeType: "image/png",
      });

      const newImageData = response.imageData;

      if (newImageData) {
        const newQuestions = [...questions];
        newQuestions[editingIndex] = { ...q, ImageData: newImageData };
        setQuestions(newQuestions);
        setEditingIndex(null);
        setEditPrompt("");
      }
    } catch (err: any) {
      setError("Failed to edit image: " + err.message);
    } finally {
      setEditLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    if (config.referenceFiles.length + files.length > 5) {
      setError("Maximum 5 reference files allowed.");
      return;
    }

    setUploading(true);
    try {
      const newFiles: ReferenceFile[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.size > 20 * 1024 * 1024) {
          console.warn(`File ${file.name} exceeds 20MB limit.`);
          continue;
        }

        const reader = new FileReader();
        const fileData = await new Promise<string>((resolve) => {
          reader.onload = (e) => {
            const result = e.target?.result as string;
            resolve(result.split(',')[1]); // get base64 part
          };
          reader.readAsDataURL(file);
        });

        newFiles.push({
          name: file.name,
          data: fileData,
          mimeType: file.type
        });
      }

      setConfig(prev => ({
        ...prev,
        referenceFiles: [...prev.referenceFiles, ...newFiles]
      }));
    } catch (err: any) {
      setError("Failed to upload files: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  const removeReferenceFile = (index: number) => {
    setConfig(prev => ({
      ...prev,
      referenceFiles: prev.referenceFiles.filter((_, i) => i !== index)
    }));
  };

  const handleAddExcludedSkill = () => {
    setConfig(prev => ({ ...prev, excludedSkills: [...prev.excludedSkills, ""] }));
  };

  const handleRemoveExcludedSkill = (index: number) => {
    setConfig(prev => ({ ...prev, excludedSkills: prev.excludedSkills.filter((_, i) => i !== index) }));
  };

  const handleExcludedSkillChange = (index: number, value: string) => {
    const newExcludedSkills = [...config.excludedSkills];
    newExcludedSkills[index] = value;
    setConfig(prev => ({ ...prev, excludedSkills: newExcludedSkills }));
  };

  const handleRecreateImage = async (index: number) => {
    setRecreatingIndex(index);
    try {
      const q = questions[index];
      const imageResponse = await callApi<{ imageData: string }>("/api/generate-image", {
        prompt: q.Image_Prompt || `Vibrant, colorful educational illustration: ${q.Image_Description}.
              STYLE: Clean flat design vector, thick outlines, solid white background.
              Include text labels (e.g., vertex letters, axis labels, units) ONLY when essential for understanding. NO ANSWERS or solutions on the image. NO CHARACTERS (no mascots, owls, or people).`,
        imageSize: config.imageSize,
      });

      const newImageData = imageResponse.imageData;

      if (newImageData) {
        const newQuestions = [...questions];
        newQuestions[index] = { ...q, ImageData: newImageData };
        setQuestions(newQuestions);
      }
    } catch (err: any) {
      setError("Failed to recreate image: " + err.message);
    } finally {
      setRecreatingIndex(null);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-bg text-text-main font-sans overflow-hidden">
      {/* Header */}
      <header className="h-16 bg-surface border-b border-border flex items-center justify-between px-6 shadow-sm shrink-0 z-10">
        <div className="flex items-center gap-2">
          <div className="bg-primary p-1.5 rounded-lg">
            <BookOpen className="text-white w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-primary leading-none">VidyaGen</h1>
            <p className="text-[11px] text-text-muted font-medium uppercase tracking-wider mt-0.5">NCERT Master Tool</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {step === 3 && (
            <>
              <button
                onClick={handleReset}
                className="btn-sleek btn-sleek-outline"
              >
                Create Another Worksheet
              </button>
              <div className="flex flex-col items-end">
                <button
                  onClick={downloadMissionBook}
                  disabled={missionBookLoading}
                  className="btn-sleek btn-sleek-outline flex items-center gap-2"
                  title="Download styled Mission Book PDF"
                >
                  {missionBookLoading
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <BookOpen className="w-4 h-4" />}
                  {missionBookLoading ? "Building..." : "Mission Book PDF"}
                </button>
                {missionBookFeedback && (
                  <p className={`text-[10px] mt-1 max-w-[240px] text-right ${missionBookFeedback.includes("max") ? "text-hard" : "text-text-muted"}`}>
                    {missionBookFeedback}
                  </p>
                )}
              </div>
              <button
                onClick={downloadZip}
                className="btn-sleek btn-sleek-primary flex items-center gap-2"
              >
                <Download className="w-4 h-4" /> Generate ZIP & XLSX
              </button>
            </>
          )}
          {step < 3 && (
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${step >= 1 ? 'bg-primary' : 'bg-border'}`} />
              <div className={`w-2 h-2 rounded-full ${step >= 2 ? 'bg-primary' : 'bg-border'}`} />
              <div className={`w-2 h-2 rounded-full ${step >= 3 ? 'bg-primary' : 'bg-border'}`} />
            </div>
          )}
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - Configuration */}
        <aside className="w-80 bg-surface border-right border-border p-6 flex flex-col gap-6 overflow-y-auto shrink-0">
          <div>
            <h3 className="section-title">Core Details</h3>
            <div className="space-y-4">
              <div className="form-group">
                <label className="text-[13px] font-medium">Learning Outcome</label>
                <textarea 
                  className="input-field min-h-[80px] resize-none"
                  placeholder="e.g., MT07A02 — Lines & Angles"
                  value={config.learningOutcome}
                  onChange={e => setConfig({ ...config, learningOutcome: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="text-[13px] font-medium">Grade Level</label>
                <select 
                  className="input-field"
                  value={config.gradeLevel}
                  onChange={e => setConfig({ ...config, gradeLevel: e.target.value })}
                >
                  {[...Array(12)].map((_, i) => (
                    <option key={i+1} value={i+1}>Grade {i+1}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="text-[13px] font-medium">Subject</label>
                <input 
                  className="input-field"
                  placeholder="e.g., Mathematics"
                  value={config.subject}
                  onChange={e => setConfig({ ...config, subject: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="text-[13px] font-medium">Language</label>
                <select 
                  className="input-field"
                  value={config.language}
                  onChange={e => setConfig({ ...config, language: e.target.value })}
                >
                  <option value="English">English</option>
                  <option value="Hindi">Hindi</option>
                  <option value="Bilingual">Bilingual</option>
                </select>
              </div>
              <div className="form-group">
                <label className="text-[13px] font-medium flex items-center justify-between">
                  Reference Chapters (PDFs - Max 5)
                </label>
                <div className="space-y-2">
                  {config.referenceFiles.map((file, idx) => (
                    <div key={idx} className="p-2 bg-primary/5 border border-primary/20 rounded-lg flex items-center gap-2 group">
                      <FileSpreadsheet className="w-4 h-4 text-primary shrink-0" />
                      <span className="text-[11px] font-medium truncate flex-1">{file.name}</span>
                      <button 
                        onClick={() => removeReferenceFile(idx)}
                        className="text-hard hover:bg-hard/10 p-1 rounded opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  
                  {config.referenceFiles.length < 5 && (
                    <div className="relative">
                      <input 
                        type="file" 
                        accept=".pdf"
                        multiple
                        onChange={handleFileUpload}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      />
                      <div className="input-field border-dashed flex flex-col items-center justify-center py-4 text-center gap-1">
                        {uploading ? (
                          <Loader2 className="w-4 h-4 animate-spin text-primary" />
                        ) : (
                          <>
                            <Plus className="w-4 h-4 text-text-muted" />
                            <span className="text-[11px] text-text-muted">Upload NCERT Chapter</span>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                <p className="text-[10px] text-text-muted mt-1 italic">AI will refer to these for diagrams & context.</p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="section-title">Configuration</h3>
            <div className="space-y-4">
              <div className="form-group">
                <div className="flex justify-between items-center">
                  <label className="text-[13px] font-medium">Total Questions</label>
                  <span className="text-xs font-bold text-primary">{config.totalQuestions}</span>
                </div>
                <input
                  type="range" min="10" max="15" step="1"
                  className="w-full h-1.5 bg-border rounded-lg appearance-none cursor-pointer accent-primary"
                  value={config.totalQuestions}
                  onChange={e => setConfig({ ...config, totalQuestions: parseInt(e.target.value) })}
                />
                <p className="text-[10px] text-text-muted mt-1 italic">Mission Book targets 10–15 questions per book.</p>
              </div>
              <div className="form-group">
                <div className="flex justify-between items-center">
                  <label className="text-[13px] font-medium">Image Question %</label>
                  <span className="text-xs font-bold text-primary">{config.imagePercentage}%</span>
                </div>
                <input 
                  type="range" min="0" max="100" step="10"
                  className="w-full h-1.5 bg-border rounded-lg appearance-none cursor-pointer accent-primary"
                  value={config.imagePercentage}
                  onChange={e => setConfig({ ...config, imagePercentage: parseInt(e.target.value) })}
                />
              </div>
              <div className="form-group">
                <label className="text-[13px] font-medium">Image Size</label>
                <select 
                  className="input-field"
                  value={config.imageSize}
                  onChange={e => setConfig({ ...config, imageSize: e.target.value as any })}
                >
                  <option value="1K">1K (Standard)</option>
                  <option value="2K">2K (High Res)</option>
                  <option value="4K">4K (Ultra Res)</option>
                </select>
              </div>
              <div className="form-group">
                <label className="text-[13px] font-medium">Additional Requirements (Optional)</label>
                <textarea 
                  className="input-field min-h-[80px] resize-none"
                  placeholder="e.g., Focus more on numerical problems, use simple vocabulary, include real-world examples..."
                  value={config.additionalRequirements}
                  onChange={e => setConfig({ ...config, additionalRequirements: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div>
            <h3 className="section-title">Mission Book</h3>
            <div className="space-y-4">
              <div className="form-group">
                <label className="text-[13px] font-medium">Monster Name</label>
                <input
                  className="input-field"
                  placeholder="e.g., Muncher, Crossangle"
                  value={monsterName}
                  onChange={e => setMonsterName(e.target.value)}
                />
                <p className="text-[10px] text-text-muted mt-1 italic">Leave blank to auto-pick from LO code.</p>
              </div>
              <div className="form-group">
                <label className="text-[13px] font-medium">Monster Image (PNG)</label>
                {monsterImageData ? (
                  <div className="p-2 bg-primary/5 border border-primary/20 rounded-lg flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-white/60 flex items-center justify-center shrink-0 overflow-hidden">
                      <img src={monsterImageData} alt="monster" className="w-8 h-8 object-contain" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-[11px] font-medium truncate block">{monsterImageName || "uploaded.png"}</span>
                      {monsterProcessing ? (
                        <span className="text-[10px] text-text-muted flex items-center gap-1">
                          <Loader2 className="w-3 h-3 animate-spin" /> Processing background…
                        </span>
                      ) : null}
                    </div>
                    <button
                      onClick={() => { setMonsterImageData(null); setMonsterImageName(""); }}
                      disabled={monsterProcessing}
                      className="text-hard hover:bg-hard/10 p-1 rounded disabled:opacity-30"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      type="file"
                      accept="image/png,image/jpeg"
                      onChange={handleMonsterImageUpload}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    <div className="input-field border-dashed flex flex-col items-center justify-center py-4 text-center gap-1">
                      <Plus className="w-4 h-4 text-text-muted" />
                      <span className="text-[11px] text-text-muted">Upload monster character</span>
                    </div>
                  </div>
                )}
                <p className="text-[10px] text-text-muted mt-1 italic">Square PNG with transparent background works best.</p>
              </div>
              <div className="text-[10px] text-text-muted bg-primary/5 border border-primary/10 rounded-lg p-2 leading-snug">
                Mission Book targets <b>4 A4 pages</b> with <b>10–15 questions</b>. Beyond that the layout may overflow.
              </div>
            </div>
          </div>

          <div className="card-sleek mt-auto">
            <h3 className="section-title mb-2">Difficulty Split</h3>
            <div className="h-2 bg-border rounded-full flex overflow-hidden mb-2">
              <div className="h-full bg-easy transition-all" style={{ width: `${(config.difficultySplit.easy / config.totalQuestions) * 100}%` }} />
              <div className="h-full bg-medium transition-all" style={{ width: `${(config.difficultySplit.medium / config.totalQuestions) * 100}%` }} />
              <div className="h-full bg-hard transition-all" style={{ width: `${(config.difficultySplit.hard / config.totalQuestions) * 100}%` }} />
            </div>
            <div className="flex justify-between text-[10px] font-bold text-text-muted">
              <span>E: {config.difficultySplit.easy}</span>
              <span>M: {config.difficultySplit.medium}</span>
              <span>H: {config.difficultySplit.hard}</span>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 bg-preview-bg overflow-y-auto p-8">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div 
                key="step1"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="max-w-2xl mx-auto space-y-6 pb-12"
              >
                <div className="card-sleek p-8">
                  <h2 className="text-xl font-bold mb-6">Define Target Skills</h2>
                  <div className="space-y-3">
                    {config.skills.map((skill, idx) => (
                      <div key={idx} className="flex gap-2">
                        <input 
                          className="input-field flex-1"
                          placeholder="Add a specific skill (e.g., Identify alternate interior angles)"
                          value={skill}
                          onChange={e => handleSkillChange(idx, e.target.value)}
                        />
                        {config.skills.length > 1 && (
                          <button onClick={() => handleRemoveSkill(idx)} className="p-2 text-text-muted hover:text-hard transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                    {config.skills.length < 10 && (
                      <button 
                        onClick={handleAddSkill}
                        className="flex items-center gap-2 text-sm font-semibold text-primary hover:underline mt-2"
                      >
                        <Plus className="w-4 h-4" /> Add Skill
                      </button>
                    )}
                  </div>
                </div>

                <div className="card-sleek p-8">
                  <h2 className="text-xl font-bold mb-6 text-hard">Skills to Exclude</h2>
                  <p className="text-[13px] text-text-muted mb-4">The tool will NOT create questions on these skills.</p>
                  <div className="space-y-3">
                    {config.excludedSkills.map((skill, idx) => (
                      <div key={idx} className="flex gap-2">
                        <input 
                          className="input-field flex-1 !border-hard/20 focus:!border-hard"
                          placeholder="Skill to exclude (optional)"
                          value={skill}
                          onChange={e => handleExcludedSkillChange(idx, e.target.value)}
                        />
                        {config.excludedSkills.length > 1 && (
                          <button onClick={() => handleRemoveExcludedSkill(idx)} className="p-2 text-text-muted hover:text-hard transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                    {config.excludedSkills.length < 10 && (
                      <button 
                        onClick={handleAddExcludedSkill}
                        className="flex items-center gap-2 text-sm font-semibold text-hard hover:underline mt-2"
                      >
                        <Plus className="w-4 h-4" /> Add Skill to Exclude
                      </button>
                    )}
                  </div>
                  
                  <div className="mt-8 pt-6 border-t border-border flex justify-end">
                    <button 
                      disabled={!validateStep1()}
                      onClick={() => setStep(2)}
                      className="btn-sleek btn-sleek-primary flex items-center gap-2 disabled:opacity-50"
                    >
                      Next: Difficulty Split <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div 
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="max-w-xl mx-auto"
              >
                <div className="card-sleek p-8">
                  <h2 className="text-xl font-bold mb-6">Set Difficulty Balance</h2>
                  <div className="space-y-6">
                    <div className="flex items-center gap-4">
                      <span className="w-20 text-sm font-medium">Easy</span>
                      <input 
                        type="number" className="input-field w-20"
                        value={config.difficultySplit.easy}
                        onChange={e => setConfig({ ...config, difficultySplit: { ...config.difficultySplit, easy: parseInt(e.target.value) || 0 } })}
                      />
                      <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                        <div className="h-full bg-easy" style={{ width: `${(config.difficultySplit.easy / config.totalQuestions) * 100}%` }}></div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="w-20 text-sm font-medium">Medium</span>
                      <input 
                        type="number" className="input-field w-20"
                        value={config.difficultySplit.medium}
                        onChange={e => setConfig({ ...config, difficultySplit: { ...config.difficultySplit, medium: parseInt(e.target.value) || 0 } })}
                      />
                      <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                        <div className="h-full bg-medium" style={{ width: `${(config.difficultySplit.medium / config.totalQuestions) * 100}%` }}></div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="w-20 text-sm font-medium">Hard</span>
                      <input 
                        type="number" className="input-field w-20"
                        value={config.difficultySplit.hard}
                        onChange={e => setConfig({ ...config, difficultySplit: { ...config.difficultySplit, hard: parseInt(e.target.value) || 0 } })}
                      />
                      <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                        <div className="h-full bg-hard" style={{ width: `${(config.difficultySplit.hard / config.totalQuestions) * 100}%` }}></div>
                      </div>
                    </div>
                    
                    {config.difficultySplit.easy + config.difficultySplit.medium + config.difficultySplit.hard !== config.totalQuestions && (
                      <div className="p-3 bg-red-50 border border-red-100 rounded-lg flex items-center gap-2 text-xs text-hard font-medium">
                        <AlertCircle className="w-4 h-4" /> Sum must equal total questions ({config.totalQuestions})
                      </div>
                    )}
                  </div>

                  <div className="mt-8 pt-6 border-t border-border flex justify-between">
                    <button onClick={() => setStep(1)} className="btn-sleek btn-sleek-outline">Back</button>
                    <button 
                      disabled={loading || config.difficultySplit.easy + config.difficultySplit.medium + config.difficultySplit.hard !== config.totalQuestions}
                      onClick={handleGenerate}
                      className="btn-sleek btn-sleek-primary flex items-center gap-2 disabled:opacity-50"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" /> {status}
                        </>
                      ) : (
                        <>
                          Generate Worksheet <Settings className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div 
                key="step3"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="max-w-4xl mx-auto space-y-6"
              >
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-xl font-bold">Worksheet Preview</h2>
                  <span className="text-sm text-text-muted font-medium">NCERT Reference: {ncertRef.split(',')[0]}</span>
                </div>

                <div className="space-y-4">
                  {questions.map((q) => (
                    <div key={q.Q_No} className="bg-surface rounded-lg border-l-4 border-primary p-6 shadow-sm border-y border-r border-border">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                          <span className="text-primary font-bold">Q{q.Q_No}</span>
                          <span className={`badge-sleek ${
                            q.Difficulty === 'Easy' ? 'bg-green-100 text-green-700' :
                            q.Difficulty === 'Medium' ? 'bg-amber-100 text-amber-700' :
                            'bg-red-100 text-red-700'
                          }`}>{q.Difficulty}</span>
                        </div>
                        <span className="text-[12px] text-text-muted font-semibold uppercase">{q.Question_Type} • {q.Marks} Mark{q.Marks > 1 ? 's' : ''}</span>
                      </div>

                      <div className="flex flex-col md:flex-row gap-6">
                        <div className="flex-1">
                          <p className="text-[15px] leading-relaxed mb-4 whitespace-pre-line">{q.Question_Text}</p>
                          
                          {(q.Question_Type === 'MCQ' || q.Question_Type === 'TICK' || q.Question_Type === 'ARR' || q.Question_Type === 'HOTS') && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
                              {['A', 'B', 'C', 'D'].map(opt => {
                                const key = `Option_${opt}` as keyof Question;
                                if (!q[key]) return null;
                                return (
                                  <div key={opt} className={`p-2.5 rounded border border-border text-[13px] ${q.Correct_Answer === opt ? 'bg-green-50 border-green-200' : ''}`}>
                                    <span className="font-bold mr-1">{opt})</span> {q[key]}
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          <div className="flex gap-4 mt-4 text-[12px] text-text-muted font-medium border-t border-slate-50 pt-3">
                            <span
                              className={q.__skillOk === false ? "text-hard" : ""}
                              title={
                                q.__skillOk === false
                                  ? "This skill name doesn't match any of your target skills."
                                  : undefined
                              }
                            >
                              Skill: {q.Skill_Mapped}
                              {q.__skillOk === false ? " ⚠" : ""}
                            </span>
                            <span>LO: {q.LO_Code}</span>
                          </div>
                        </div>

                        {q.Has_Image === "Yes" && q.ImageData && (
                          <div className="w-full md:w-64 shrink-0">
                            <div className="aspect-square bg-slate-100 rounded border border-border flex items-center justify-center overflow-hidden relative group">
                              <img 
                                src={`data:image/png;base64,${q.ImageData}`} 
                                alt={q.Image_Description}
                                className="max-w-full max-h-full object-contain"
                              />
                              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-3 gap-2">
                                <button 
                                  onClick={() => {
                                    setEditingIndex(questions.indexOf(q));
                                    setEditPrompt("");
                                  }}
                                  className="w-full bg-white text-primary px-3 py-1.5 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 hover:bg-primary hover:text-white transition-colors"
                                >
                                  <Wand2 className="w-3 h-3" /> Edit with AI
                                </button>
                                <button 
                                  disabled={recreatingIndex === questions.indexOf(q)}
                                  onClick={() => handleRecreateImage(questions.indexOf(q))}
                                  className="w-full bg-white text-primary px-3 py-1.5 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 hover:bg-primary hover:text-white transition-colors disabled:opacity-50"
                                >
                                  {recreatingIndex === questions.indexOf(q) ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <RefreshCw className="w-3 h-3" />
                                  )}
                                  Recreate
                                </button>
                                <button 
                                  onClick={() => setShowPromptIndex(questions.indexOf(q))}
                                  className="w-full bg-white/20 text-white border border-white/30 px-3 py-1.5 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 hover:bg-white/40 transition-colors"
                                >
                                  <Eye className="w-3 h-3" /> Show Prompt
                                </button>
                              </div>
                            </div>
                            <p className="text-[10px] text-text-muted text-center mt-1 font-mono uppercase">{q.Image_Filename}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>

      {error && (
        <div className="fixed bottom-6 right-6 max-w-sm bg-hard text-white p-4 rounded-lg shadow-xl flex gap-3 items-start z-50">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-bold">Generation Error</p>
            <p className="text-xs opacity-90 mt-1">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="text-white/80 hover:text-white">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Edit Image Modal */}
      <AnimatePresence>
        {editingIndex !== null && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-surface w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-border flex justify-between items-center">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <Wand2 className="text-primary w-5 h-5" /> Edit Image with AI
                </h3>
                <button onClick={() => setEditingIndex(null)} className="text-text-muted hover:text-text-main">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="aspect-video bg-slate-100 rounded-lg border border-border overflow-hidden flex items-center justify-center">
                  <img 
                    src={`data:image/png;base64,${questions[editingIndex].ImageData}`} 
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
                <div className="form-group">
                  <label className="text-[13px] font-medium">Describe your changes</label>
                  <textarea 
                    className="input-field min-h-[100px] resize-none mt-1"
                    placeholder="e.g., Make the colors more vibrant, add a sun in the corner, or change the labels to Hindi..."
                    value={editPrompt}
                    onChange={e => setEditPrompt(e.target.value)}
                  />
                </div>
              </div>
              <div className="p-6 bg-slate-50 flex justify-end gap-3">
                <button 
                  onClick={() => setEditingIndex(null)}
                  className="btn-sleek btn-sleek-outline"
                >
                  Cancel
                </button>
                <button 
                  disabled={editLoading || !editPrompt}
                  onClick={handleEditImage}
                  className="btn-sleek btn-sleek-primary flex items-center gap-2"
                >
                  {editLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Applying Changes...
                    </>
                  ) : (
                    <>
                      Apply AI Edit <Wand2 className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Show Prompt Modal */}
      <AnimatePresence>
        {showPromptIndex !== null && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="bg-surface w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-border flex justify-between items-center">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <ImageIcon className="text-primary w-5 h-5" /> Image Generation Prompt
                </h3>
                <button onClick={() => setShowPromptIndex(null)} className="text-text-muted hover:text-text-main">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6">
                <div className="bg-slate-50 p-4 rounded-xl border border-border relative group">
                  <p className="text-sm text-text-main leading-relaxed font-mono whitespace-pre-wrap">
                    {questions[showPromptIndex].Image_Prompt || "No prompt available."}
                  </p>
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(questions[showPromptIndex].Image_Prompt || "");
                    }}
                    className="absolute top-2 right-2 p-2 bg-white border border-border rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-slate-50"
                    title="Copy to clipboard"
                  >
                    <Copy className="w-4 h-4 text-text-muted" />
                  </button>
                </div>
                <p className="text-[11px] text-text-muted mt-4 italic">
                  This prompt was used to generate the current image. You can copy it to use in other AI image generators.
                </p>
              </div>
              <div className="p-6 bg-slate-50 flex justify-end">
                <button 
                  onClick={() => setShowPromptIndex(null)}
                  className="btn-sleek btn-sleek-primary"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {missionBookOpen && (() => {
        const rawLO = (config.learningOutcome || "").trim();
        const loPrefixMatch = rawLO.match(/^([A-Z0-9_-]+)\s*[—–-]\s*/i);
        const loCode = loPrefixMatch ? loPrefixMatch[1] : "";
        const cleanedLO = rawLO.replace(/^[A-Z0-9_-]+\s*[—–-]\s*/i, "").trim();
        const lessonTitle = cleanedLO || rawLO || "Mission Book";
        return (
          <MissionBookPreview
            gradeLevel={config.gradeLevel}
            lessonTitle={lessonTitle}
            lessonCode={`L${config.gradeLevel}`}
            loCode={loCode}
            monsterName={monsterName}
            monsterImage={monsterImageData}
            solvedExample={solvedExample}
            questions={questions.map(q => ({
              Q_No: q.Q_No,
              Question_Type: q.Question_Type,
              Question_Text: q.Question_Text,
              Option_A: q.Option_A,
              Option_B: q.Option_B,
              Option_C: q.Option_C,
              Option_D: q.Option_D,
              Has_Image: q.Has_Image,
              ImageData: q.ImageData,
              Layout_Hint: q.Layout_Hint,
              Template: q.Template,
            }))}
            subject={config.subject}
            learningOutcome={config.learningOutcome}
            skills={config.skills.map(s => s.trim()).filter(Boolean)}
            excludedSkills={config.excludedSkills.map(s => s.trim()).filter(Boolean)}
            referenceParts={config.referenceFiles.map(f => ({
              inlineData: { data: f.data, mimeType: f.mimeType },
            }))}
            onClose={() => setMissionBookOpen(false)}
          />
        );
      })()}
    </div>
  );
}
