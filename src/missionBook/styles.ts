import { StyleSheet } from "@react-pdf/renderer";

export const GRADE_COLORS: Record<number, string> = {
  3: "#F4A89A",
  4: "#FFCFA3",
  5: "#F9DC6E",
  6: "#C8E66E",
  7: "#5BB3F0",
  8: "#F08177",
  9: "#A98AD9",
  10: "#E862A8",
  11: "#5DCBC8",
  12: "#C8B0E2",
};

export function gradeColor(gradeLevel: string | number): string {
  const n = parseInt(String(gradeLevel), 10);
  return GRADE_COLORS[n] || GRADE_COLORS[5];
}

export function gradeAssetUrl(gradeLevel: string | number): string {
  const n = parseInt(String(gradeLevel), 10);
  const grade = GRADE_COLORS[n] ? n : 5;
  return `/mission-book/Grade-${grade}.png`;
}

export const styles = StyleSheet.create({
  page: {
    paddingTop: 95,
    paddingBottom: 40,
    paddingHorizontal: 36,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#1a1a1a",
    position: "relative",
  },
  pageBackground: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
  },
  headerLeftPill: {
    position: "absolute",
    top: 26,
    left: 18,
    width: 90,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  headerCenterPill: {
    position: "absolute",
    top: 18,
    left: 120,
    width: 360,
    height: 44,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  headerRightPill: {
    position: "absolute",
    top: 26,
    right: 56,
    width: 38,
    height: 32,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  headerLeftText: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#333",
    textAlign: "center",
  },
  headerCenterText: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: "#ffffff",
    textAlign: "center",
  },
  headerRightText: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: "#ffffff",
    textAlign: "center",
  },

  coverBody: {
    marginTop: 80,
    alignItems: "center",
    justifyContent: "center",
  },
  coverEyebrow: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 4,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  coverTitle: {
    fontSize: 32,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    marginBottom: 24,
    paddingHorizontal: 24,
  },
  coverMeta: {
    fontSize: 14,
    color: "#444",
    marginBottom: 4,
    textAlign: "center",
  },

  sectionLabel: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    marginTop: 4,
    marginBottom: 4,
  },
  bodyText: {
    fontSize: 11,
    lineHeight: 1.5,
    marginBottom: 10,
  },
  answerPill: {
    alignSelf: "flex-end",
    marginTop: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
  },
  answerPillText: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: "#1a1a1a",
  },

  questionsHeader: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  qGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  qCard: {
    width: "48.5%",
    marginBottom: 12,
    paddingTop: 4,
    paddingBottom: 8,
    paddingHorizontal: 6,
  },
  qHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 4,
    gap: 6,
  },
  qNumberBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 6,
  },
  qNumberText: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#ffffff",
  },
  qText: {
    fontSize: 10,
    lineHeight: 1.4,
    flex: 1,
    flexWrap: "wrap",
  },
  hotsBadge: {
    marginLeft: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    backgroundColor: "#FFD166",
  },
  hotsBadgeText: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#5b3700",
  },
  qImageWrap: {
    marginTop: 4,
    marginBottom: 4,
    alignItems: "center",
  },
  qImage: {
    maxWidth: 140,
    maxHeight: 100,
  },
  optGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 4,
  },
  optCell: {
    width: "50%",
    paddingRight: 6,
    paddingBottom: 3,
    fontSize: 9.5,
    lineHeight: 1.35,
  },
  matchTable: {
    borderWidth: 0.5,
    borderColor: "#cbd5e0",
    borderRadius: 4,
    marginTop: 4,
    overflow: "hidden",
  },
  matchRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#e2e8f0",
  },
  matchRowAlt: {
    backgroundColor: "#f7fafc",
  },
  matchCell: {
    flex: 1,
    padding: 4,
    fontSize: 9.5,
  },
  matchCellLeft: {
    borderRightWidth: 0.5,
    borderRightColor: "#e2e8f0",
  },

  pageFooter: {
    position: "absolute",
    bottom: 18,
    left: 36,
    right: 36,
    textAlign: "center",
    fontSize: 9,
    color: "#888",
  },
});
