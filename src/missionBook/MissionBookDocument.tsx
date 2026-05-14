import React from "react";
import {
  Document,
  Page,
  View,
  Text,
  Image,
} from "@react-pdf/renderer";
import { styles, gradeColor, gradeAssetUrl } from "./styles";
import { getMonster } from "./monsters";
import type { PackedPage, PackedCard } from "./layout";

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
  Layout_Hint?: string;
  Template?: string;
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
  loCode?: string;
  monsterOverride?: { name?: string; asset?: string | null };
  solvedExample: SolvedExample | null;
  packedPages: PackedPage[];
}

function shortenTitle(s: string, max = 50): string {
  const t = (s || "").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return (space > 24 ? cut.slice(0, space) : cut).trim() + "…";
}

function widthPct(w: number): string {
  return `${(w * 100).toFixed(2)}%`;
}

function Header({
  gradeLevel,
  lessonTitle,
  lessonCode,
  monsterName,
  monsterAsset,
}: {
  gradeLevel: string;
  lessonTitle: string;
  lessonCode: string;
  monsterName: string;
  monsterAsset: string | null;
}) {
  const color = gradeColor(gradeLevel);
  return (
    <>
      {monsterAsset ? (
        <View style={styles.monsterCircle} fixed>
          <Image src={monsterAsset} style={styles.monsterImage} />
        </View>
      ) : null}
      <View style={[styles.monsterNamePill, { backgroundColor: color }]} fixed>
        <Text style={styles.monsterNameText}>{monsterName}</Text>
      </View>
      <View style={styles.headerCenterPill} fixed>
        <Text style={[styles.headerCenterText, { color }]}>
          {shortenTitle(lessonTitle)}
        </Text>
      </View>
      <View style={styles.headerRightPill} fixed>
        <Text style={[styles.headerRightText, { color }]}>{lessonCode}</Text>
      </View>
    </>
  );
}

function SolvedExampleCard({
  gradeLevel,
  example,
}: {
  gradeLevel: string;
  example: SolvedExample;
}) {
  const color = gradeColor(gradeLevel);
  return (
    <View style={styles.solvedCard} wrap={false}>
      <Text style={styles.solvedHeading}>SOLVED EXAMPLE:</Text>
      <Text style={styles.solvedBody}>{example.problem}</Text>
      <Text style={styles.solvedHeading}>EXPLANATION:</Text>
      <Text style={styles.solvedBody}>{example.explanation}</Text>
      <View style={[styles.answerPill, { backgroundColor: color }]}>
        <Text style={styles.answerPillText}>Answer: {example.answer}</Text>
      </View>
    </View>
  );
}

function McqOptions({ q, twoCol }: { q: MissionBookQuestion; twoCol: boolean }) {
  const opts = [
    { label: "a", text: q.Option_A },
    { label: "b", text: q.Option_B },
    { label: "c", text: q.Option_C },
    { label: "d", text: q.Option_D },
  ].filter((o) => !!o.text);
  if (opts.length === 0) return null;
  const cellStyle = twoCol ? styles.optCell2 : styles.optCell1;
  return (
    <View style={styles.optGrid}>
      {opts.map((o) => (
        <Text key={o.label} style={cellStyle}>
          ({o.label}) {o.text}
        </Text>
      ))}
    </View>
  );
}

function MatchTable({ q, gradeLevel }: { q: MissionBookQuestion; gradeLevel: string }) {
  const color = gradeColor(gradeLevel);
  const opts = [q.Option_A, q.Option_B, q.Option_C, q.Option_D].filter(Boolean) as string[];
  const rows = opts.map((raw) => {
    const m = raw.match(/^\s*([^-–:,]+)\s*[-–:,]\s*(.+)$/);
    return m ? [m[1].trim(), m[2].trim()] : [raw, ""];
  });

  return (
    <View style={styles.matchTable} wrap={false}>
      <View style={[styles.matchHeaderRow, { backgroundColor: color }]}>
        <Text style={[styles.matchHeaderCell, { borderRightWidth: 0.5, borderRightColor: "#ffffff66" }]}>
          Column A
        </Text>
        <Text style={styles.matchHeaderCell}>Column B</Text>
      </View>
      {rows.map((r, i) => (
        <View key={i} style={i % 2 === 1 ? styles.matchRowAlt : styles.matchRow}>
          <Text style={styles.matchCell}>{r[0]}</Text>
          <Text style={styles.matchCellLast}>{r[1]}</Text>
        </View>
      ))}
    </View>
  );
}

function FibLines({ q }: { q: MissionBookQuestion }) {
  const stem = q.Question_Text || "";
  const parts = stem.match(/\b[a-eA-E]\)/g) || [];
  const n = Math.max(parts.length, 1);
  const labels = Array.from({ length: n }, (_, i) => String.fromCharCode(97 + i));
  return (
    <View>
      {labels.map((l) => (
        <View key={l} style={styles.fibLineRow}>
          {n > 1 ? <Text style={styles.fibLabel}>{l})</Text> : null}
          <View style={styles.fibLine} />
        </View>
      ))}
    </View>
  );
}

function QuestionCard({
  card,
  gradeLevel,
}: {
  card: PackedCard;
  gradeLevel: string;
}) {
  const { q, width, hint } = card;
  const color = gradeColor(gradeLevel);
  const type = (q.Question_Type || "MCQ").toUpperCase();
  const isHots = type === "HOTS";
  const isFib = type === "FIB";
  const isMatch = type === "MATCH" || hint === "table";
  const hasImage = q.Has_Image === "Yes" && q.ImageData;

  return (
    <View
      style={[styles.qCardBase, { width: widthPct(width) }]}
      wrap={false}
    >
      <View style={styles.qHeader}>
        <View style={[styles.qNumberBadge, { backgroundColor: color }]}>
          <Text style={styles.qNumberText}>{q.Q_No}</Text>
        </View>
        <Text style={styles.qText}>{q.Question_Text}</Text>
        {isHots ? (
          <View style={styles.hotsIcon}>
            <Text style={styles.hotsIconText}>?</Text>
          </View>
        ) : null}
      </View>
      {hasImage ? (
        <View style={styles.qImageWrap}>
          <Image
            style={width >= 1 ? styles.qImageFullWidth : styles.qImage}
            src={`data:image/png;base64,${q.ImageData}`}
          />
        </View>
      ) : null}
      {isMatch ? (
        <MatchTable q={q} gradeLevel={gradeLevel} />
      ) : isFib ? (
        <FibLines q={q} />
      ) : (
        <McqOptions q={q} twoCol={width >= 1} />
      )}
    </View>
  );
}

export default function MissionBookDocument(input: MissionBookInput) {
  const {
    gradeLevel,
    lessonTitle,
    lessonCode,
    loCode,
    monsterOverride,
    solvedExample,
    packedPages,
  } = input;

  const fallback = getMonster(loCode, gradeLevel);
  const monster = {
    name: monsterOverride?.name?.trim() || fallback.name,
    asset:
      monsterOverride?.asset !== undefined
        ? monsterOverride.asset
        : fallback.asset,
  };

  return (
    <Document title={`Mission Book — ${lessonTitle}`}>
      {packedPages.map((page, pi) => (
        <Page key={pi} size="A4" style={styles.page} wrap={false}>
          <Image
            src={gradeAssetUrl(gradeLevel)}
            style={styles.pageBackground}
            fixed
          />
          <Header
            gradeLevel={gradeLevel}
            lessonTitle={lessonTitle}
            lessonCode={lessonCode}
            monsterName={monster.name}
            monsterAsset={monster.asset}
          />
          {pi === 0 ? (
            <>
              <Text style={styles.practiceLabel}>Practice Question</Text>
              {solvedExample ? (
                <SolvedExampleCard
                  gradeLevel={gradeLevel}
                  example={solvedExample}
                />
              ) : null}
            </>
          ) : null}
          {page.rows.map((row, ri) => (
            <View key={ri} style={styles.qRow}>
              {row.cards.map((card) => (
                <QuestionCard
                  key={card.q.Q_No}
                  card={card}
                  gradeLevel={gradeLevel}
                />
              ))}
            </View>
          ))}
        </Page>
      ))}
    </Document>
  );
}
