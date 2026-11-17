export const DEMO = process.env.HELP_DEMO !== "0";

export const IDS = DEMO
  ? {
      workspace: "01K0000000000",
      endedDiarized: "01KH000001001",
      reviewing: "01KH000001001",
      confirmed: "01KH000001002",
      live: "01KH000001003",
      notStarted: "01KH000001003",
      contextNote: "01KH000001003",
      details: "01KH000001001",
    }
  : {
      workspace: "01K0000000000",
      notStarted: "01K0000000005",
      details: "01K0000000002",
      endedDiarized: "01K0000000020",
      paused: "01K0000000006",
      timeline: "01K0000000016",
      contextNote: "01K0000000005",
      reviewing: "01K0000000920",
    };
