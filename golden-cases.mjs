export const goldenCases = [
  {
    id: "pinduoduo",
    source: "scratch/modules/Pinduoduo.lpx",
    expected: ["scratch/.gist-77e4c94/Pinduoduo_AD_Anywhere.amrs"],
    skipReason: "",
  },
  {
    id: "hupu",
    source: "scratch/modules/Hupu.lpx",
    expected: [
      "scratch/.gist-77e4c94/Hupu_AD_Anywhere.amrs",
      "scratch/.gist-77e4c94/Hupu_Reject.arrs",
    ],
    skipReason: "",
  },
  {
    id: "autonavi",
    source: "scratch/modules/AutoNavi.lpx",
    expected: [
      "scratch/.gist-77e4c94/AutoNavi_AD_Anywhere.amrs",
      "scratch/.gist-77e4c94/AutoNavi_Reject.arrs",
    ],
    skipReason: "",
  },
  {
    id: "pixiv",
    source: "scratch/modules/Pixiv.lpx",
    expected: [
      "scratch/.gist-77e4c94/Pixiv_AD_Anywhere.amrs",
      "scratch/.gist-77e4c94/Pixiv_Reject.arrs",
    ],
    skipReason: "",
  },
  {
    id: "fanqienovel",
    source: "scratch/modules/FanQieNovel.lpx",
    expected: [
      "scratch/.gist-77e4c94/FanQieNovel_AD_Anywhere.amrs",
      "scratch/.gist-77e4c94/FanQieNovel_Reject.arrs",
    ],
    skipReason: "",
  },
  {
    id: "ximalaya",
    source: "scratch/modules/Ximalaya.lpx",
    expected: [
      "scratch/.gist-77e4c94/Ximalaya_AD_Anywhere.amrs",
      "scratch/.gist-77e4c94/Ximalaya_Reject.arrs",
    ],
    skipReason: "",
  },
  {
    id: "smzdm",
    source: "scratch/modules/SMZDM.lpx",
    expected: [
      "scratch/.gist-77e4c94/SMZDM_AD_Anywhere.amrs",
      "scratch/.gist-77e4c94/SMZDM_Reject.arrs",
    ],
    scriptFixtures: {
      "https://raw.githubusercontent.com/fmz200/wool_scripts/main/Scripts/smzdm/smzdm_ads.js": "scratch/scripts/smzdm_ads.js",
      "https://raw.githubusercontent.com/fmz200/wool_scripts/main/Scripts/smzdm/Smzdm.js": "scratch/scripts/smzdm.js",
    },
    skipReason: "",
  },
  {
    id: "bank",
    source: "scratch/modules/Bank.module",
    expected: [
      "scratch/.gist-77e4c94/Bank_AD_Anywhere.amrs",
      "scratch/.gist-77e4c94/Bank_Reject.arrs",
    ],
    skipReason: "",
  },
  {
    id: "amap-enhanced",
    source: "scratch/modules/Amap.lpx",
    expected: [
      "scratch/.gist-77e4c94/Amap_AD_Enhanced_Anywhere.amrs",
      "scratch/.gist-77e4c94/Amap_Enhanced_Reject.arrs",
    ],
    scriptFixtures: {
      "https://kelee.one/Resource/JavaScript/Amap/Amap_remove_ads.js": "scratch/scripts/amap.js",
    },
    skipReason: "",
  },
];
