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
    paddingTop: 96,
    paddingBottom: 30,
    paddingHorizontal: 28,
    fontSize: 9.5,
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

  monsterCircle: {
    position: "absolute",
    top: 12,
    left: 18,
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  monsterImage: {
    width: 60,
    height: 60,
  },
  monsterNamePill: {
    position: "absolute",
    top: 70,
    left: 14,
    width: 78,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  monsterNameText: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#ffffff",
    textAlign: "center",
  },

  headerCenterPill: {
    position: "absolute",
    top: 22,
    left: 110,
    width: 360,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  headerCenterText: {
    fontSize: 15,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
  },
  headerRightPill: {
    position: "absolute",
    top: 22,
    right: 36,
    width: 42,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  headerRightText: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
  },

  practiceLabel: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 6,
    color: "#c75a3a",
  },

  qRow: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 6,
    marginBottom: 6,
  },

  qCardBase: {
    paddingTop: 6,
    paddingBottom: 6,
    paddingHorizontal: 8,
    borderWidth: 0.6,
    borderColor: "#d8d8d8",
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.55)",
  },

  solvedCard: {
    width: "100%",
    marginBottom: 6,
    paddingTop: 8,
    paddingBottom: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: "#ECECEC",
  },
  solvedHeading: {
    fontSize: 10.5,
    fontFamily: "Helvetica-Bold",
    marginBottom: 2,
  },
  solvedBody: {
    fontSize: 10,
    lineHeight: 1.4,
    marginBottom: 4,
  },
  answerPill: {
    alignSelf: "flex-end",
    marginTop: 2,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  answerPillText: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#1a1a1a",
  },

  qHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 3,
    gap: 4,
  },
  qNumberBadge: {
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 4,
    marginTop: 1,
  },
  qNumberText: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#ffffff",
  },
  qText: {
    fontSize: 9.5,
    lineHeight: 1.32,
    flex: 1,
    flexWrap: "wrap",
  },
  hotsIcon: {
    marginLeft: 3,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#FFD166",
    alignItems: "center",
    justifyContent: "center",
  },
  hotsIconText: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#5b3700",
  },

  qImageWrap: {
    marginTop: 2,
    marginBottom: 2,
    alignItems: "center",
  },
  qImage: {
    maxWidth: 130,
    maxHeight: 90,
  },
  qImageFullWidth: {
    maxWidth: 280,
    maxHeight: 130,
  },

  optGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 2,
  },
  optCell2: {
    width: "50%",
    paddingRight: 6,
    paddingBottom: 2,
    fontSize: 9,
    lineHeight: 1.25,
  },
  optCell1: {
    width: "100%",
    paddingRight: 6,
    paddingBottom: 2,
    fontSize: 9,
    lineHeight: 1.25,
  },

  matchTable: {
    marginTop: 4,
    borderWidth: 0.6,
    borderColor: "#cfa37a",
    borderRadius: 4,
    overflow: "hidden",
  },
  matchHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#9bcf9b",
  },
  matchRow: {
    flexDirection: "row",
    borderTopWidth: 0.5,
    borderTopColor: "#e5d0bb",
  },
  matchRowAlt: {
    flexDirection: "row",
    borderTopWidth: 0.5,
    borderTopColor: "#e5d0bb",
    backgroundColor: "#fbe7d4",
  },
  matchCell: {
    flex: 1,
    paddingVertical: 4,
    paddingHorizontal: 8,
    fontSize: 9,
    borderRightWidth: 0.5,
    borderRightColor: "#e5d0bb",
  },
  matchCellLast: {
    flex: 1,
    paddingVertical: 4,
    paddingHorizontal: 8,
    fontSize: 9,
  },
  matchHeaderCell: {
    flex: 1,
    paddingVertical: 4,
    paddingHorizontal: 8,
    fontSize: 9.5,
    fontFamily: "Helvetica-Bold",
    color: "#ffffff",
  },

  fibLineRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 3,
    gap: 4,
  },
  fibLabel: {
    fontSize: 9.5,
    width: 16,
  },
  fibLine: {
    flex: 1,
    borderBottomWidth: 0.8,
    borderBottomColor: "#9a9a9a",
    height: 12,
  },

  pageFooter: {
    position: "absolute",
    bottom: 14,
    left: 36,
    right: 36,
    textAlign: "center",
    fontSize: 8.5,
    color: "#888",
  },
});
