import React from "react";
import {
  Document,
  Page,
  View,
  Text,
  Image,
} from "@react-pdf/renderer";
import { styles, gradeColor, gradeAssetUrl } from "./styles";

export interface MissionBookQuestion {
  Q_No: number;
  Question_Type: string;
  Question_Text: string;
  Option_A?: string;
  Option_B?: string;
  Option_C?: string;
  Option_D?: string;
  Has_Image?: string;
  ImageData?: string;
}

export interface SolvedExample {
  problem: string;
  explanation: string;
  answer: string;
}

export interface MissionBookInput {
  gradeLevel: string;
  subject: string;
  lessonTitle: string;
  lessonCode: string;
  solvedExample: SolvedExample | null;
  questions: MissionBookQuestion[];
}

function PageFrame({ gradeLevel, children, footerLabel }: {
  gradeLevel: string;
  children: React.ReactNode;
  footerLabel?: string;
}) {
  return (
    <Page size="A4" style={styles.page} wrap>
      <Image src={gradeAssetUrl(gradeLevel)} style={styles.pageBackground} fixed />
      {children}
      {footerLabel ? (
        <Text style={styles.pageFooter} fixed render={({ pageNumber, totalPages }) => `${footerLabel}  •  Page ${pageNumber} / ${totalPages}`} />
      ) : null}
    </Page>
  );
}

function shortenTitle(s: string, max = 56): string {
  const t = (s || "").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return (space > 24 ? cut.slice(0, space) : cut).trim() + "…";
}

function Header({
  gradeLevel,
  subject,
  lessonTitle,
  lessonCode,
}: {
  gradeLevel: string;
  subject: string;
  lessonTitle: string;
  lessonCode: string;
}) {
  const color = gradeColor(gradeLevel);
  return (
    <>
      <View style={styles.headerLeftPill} fixed>
        <Text style={styles.headerLeftText}>{subject}</Text>
      </View>
      <View style={[styles.headerCenterPill, { backgroundColor: color }]} fixed>
        <Text style={styles.headerCenterText}>{shortenTitle(lessonTitle)}</Text>
      </View>
      <View style={[styles.headerRightPill, { backgroundColor: color }]} fixed>
        <Text style={styles.headerRightText}>{lessonCode}</Text>
      </View>
    </>
  );
}

function SolvedExampleBody({
  gradeLevel,
  example,
}: {
  gradeLevel: string;
  example: SolvedExample;
}) {
  const color = gradeColor(gradeLevel);
  return (
    <View>
      <Text style={styles.sectionLabel}>SOLVED EXAMPLE:</Text>
      <Text style={styles.bodyText}>{example.problem}</Text>
      <Text style={styles.sectionLabel}>EXPLANATION:</Text>
      <Text style={styles.bodyText}>{example.explanation}</Text>
      <View style={[styles.answerPill, { backgroundColor: color }]}>
        <Text style={styles.answerPillText}>Answer: {example.answer}</Text>
      </View>
    </View>
  );
}

function McqOptions({ q }: { q: MissionBookQuestion }) {
  const opts: { label: string; text?: string }[] = [
    { label: "a", text: q.Option_A },
    { label: "b", text: q.Option_B },
    { label: "c", text: q.Option_C },
    { label: "d", text: q.Option_D },
  ].filter((o) => !!o.text);
  if (opts.length === 0) return null;
  return (
    <View style={styles.optGrid}>
      {opts.map((o) => (
        <Text key={o.label} style={styles.optCell}>
          ({o.label}) {o.text}
        </Text>
      ))}
    </View>
  );
}

function QuestionCard({
  q,
  gradeLevel,
}: {
  q: MissionBookQuestion;
  gradeLevel: string;
}) {
  const color = gradeColor(gradeLevel);
  const type = (q.Question_Type || "MCQ").toUpperCase();
  const isHots = type === "HOTS";
  const isFib = type === "FIB";
  const hasImage = q.Has_Image === "Yes" && q.ImageData;

  return (
    <View style={styles.qCard} wrap={false}>
      <View style={styles.qHeader}>
        <View style={[styles.qNumberBadge, { backgroundColor: color }]}>
          <Text style={styles.qNumberText}>{q.Q_No}</Text>
        </View>
        <Text style={styles.qText}>{q.Question_Text}</Text>
        {isHots ? (
          <View style={styles.hotsBadge}>
            <Text style={styles.hotsBadgeText}>HOTS</Text>
          </View>
        ) : null}
      </View>
      {hasImage ? (
        <View style={styles.qImageWrap}>
          <Image
            style={styles.qImage}
            src={`data:image/png;base64,${q.ImageData}`}
          />
        </View>
      ) : null}
      {isFib ? null : <McqOptions q={q} />}
    </View>
  );
}

export default function MissionBookDocument(input: MissionBookInput) {
  const { gradeLevel, subject, lessonTitle, lessonCode, solvedExample, questions } = input;
  const footer = `${subject} • Grade ${gradeLevel}`;
  return (
    <Document title={`Mission Book — ${lessonTitle}`}>
      {solvedExample ? (
        <PageFrame gradeLevel={gradeLevel} footerLabel={footer}>
          <Header
            gradeLevel={gradeLevel}
            subject={subject}
            lessonTitle={lessonTitle}
            lessonCode={lessonCode}
          />
          <SolvedExampleBody gradeLevel={gradeLevel} example={solvedExample} />
        </PageFrame>
      ) : null}

      <PageFrame gradeLevel={gradeLevel} footerLabel={footer}>
        <Header
          gradeLevel={gradeLevel}
          subject={subject}
          lessonTitle={lessonTitle}
          lessonCode={lessonCode}
        />
        <Text style={styles.questionsHeader}>Practice Questions</Text>
        <View style={styles.qGrid}>
          {questions.map((q) => (
            <QuestionCard key={q.Q_No} q={q} gradeLevel={gradeLevel} />
          ))}
        </View>
      </PageFrame>
    </Document>
  );
}
