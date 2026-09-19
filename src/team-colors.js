/** Canonical source-supplied E29/B17 palette, including separate Neutral Hostile. */
export const TEAM_COLORS = Object.freeze([
  {
    "sourceKey": "0",
    "index": 0,
    "name": "Red",
    "sourceCode": "|cffff0303",
    "rgbHex": "#ff0303",
    "rgb": [
      255,
      3,
      3
    ]
  },
  {
    "sourceKey": "1",
    "index": 1,
    "name": "Blue",
    "sourceCode": "|cff0042ff",
    "rgbHex": "#0042ff",
    "rgb": [
      0,
      66,
      255
    ]
  },
  {
    "sourceKey": "2",
    "index": 2,
    "name": "Teal",
    "sourceCode": "|cff1be7ba",
    "rgbHex": "#1be7ba",
    "rgb": [
      27,
      231,
      186
    ]
  },
  {
    "sourceKey": "3",
    "index": 3,
    "name": "Purple",
    "sourceCode": "|cff550081",
    "rgbHex": "#550081",
    "rgb": [
      85,
      0,
      129
    ]
  },
  {
    "sourceKey": "4",
    "index": 4,
    "name": "Yellow",
    "sourceCode": "|cfffefc00",
    "rgbHex": "#fefc00",
    "rgb": [
      254,
      252,
      0
    ]
  },
  {
    "sourceKey": "5",
    "index": 5,
    "name": "Orange",
    "sourceCode": "|cfffe890d",
    "rgbHex": "#fe890d",
    "rgb": [
      254,
      137,
      13
    ]
  },
  {
    "sourceKey": "6",
    "index": 6,
    "name": "Green",
    "sourceCode": "|cff21bf00",
    "rgbHex": "#21bf00",
    "rgb": [
      33,
      191,
      0
    ]
  },
  {
    "sourceKey": "7",
    "index": 7,
    "name": "Pink",
    "sourceCode": "|cffe45caf",
    "rgbHex": "#e45caf",
    "rgb": [
      228,
      92,
      175
    ]
  },
  {
    "sourceKey": "8",
    "index": 8,
    "name": "Grey",
    "sourceCode": "|cff939596",
    "rgbHex": "#939596",
    "rgb": [
      147,
      149,
      150
    ]
  },
  {
    "sourceKey": "9",
    "index": 9,
    "name": "Light Blue",
    "sourceCode": "|cff7ebff1",
    "rgbHex": "#7ebff1",
    "rgb": [
      126,
      191,
      241
    ]
  },
  {
    "sourceKey": "10",
    "index": 10,
    "name": "Dark Green",
    "sourceCode": "|cff106247",
    "rgbHex": "#106247",
    "rgb": [
      16,
      98,
      71
    ]
  },
  {
    "sourceKey": "11",
    "index": 11,
    "name": "Brown",
    "sourceCode": "|cff4f2b05",
    "rgbHex": "#4f2b05",
    "rgb": [
      79,
      43,
      5
    ]
  },
  {
    "sourceKey": "12",
    "index": 12,
    "name": "Maroon",
    "sourceCode": "|cff9c0000",
    "rgbHex": "#9c0000",
    "rgb": [
      156,
      0,
      0
    ]
  },
  {
    "sourceKey": "13",
    "index": 13,
    "name": "Navy",
    "sourceCode": "|cff0000c3",
    "rgbHex": "#0000c3",
    "rgb": [
      0,
      0,
      195
    ]
  },
  {
    "sourceKey": "14",
    "index": 14,
    "name": "Aqua",
    "sourceCode": "|cff00ebff",
    "rgbHex": "#00ebff",
    "rgb": [
      0,
      235,
      255
    ]
  },
  {
    "sourceKey": "15",
    "index": 15,
    "name": "Violet",
    "sourceCode": "|cffbd00ff",
    "rgbHex": "#bd00ff",
    "rgb": [
      189,
      0,
      255
    ]
  },
  {
    "sourceKey": "16",
    "index": 16,
    "name": "Wheat",
    "sourceCode": "|cffecce87",
    "rgbHex": "#ecce87",
    "rgb": [
      236,
      206,
      135
    ]
  },
  {
    "sourceKey": "17",
    "index": 17,
    "name": "Peach",
    "sourceCode": "|cfff7a58b",
    "rgbHex": "#f7a58b",
    "rgb": [
      247,
      165,
      139
    ]
  },
  {
    "sourceKey": "18",
    "index": 18,
    "name": "Mint",
    "sourceCode": "|cffbfff81",
    "rgbHex": "#bfff81",
    "rgb": [
      191,
      255,
      129
    ]
  },
  {
    "sourceKey": "19",
    "index": 19,
    "name": "Lavender",
    "sourceCode": "|cffdbb8eb",
    "rgbHex": "#dbb8eb",
    "rgb": [
      219,
      184,
      235
    ]
  },
  {
    "sourceKey": "20",
    "index": 20,
    "name": "Coal",
    "sourceCode": "|cff4f5055",
    "rgbHex": "#4f5055",
    "rgb": [
      79,
      80,
      85
    ]
  },
  {
    "sourceKey": "21",
    "index": 21,
    "name": "Snow",
    "sourceCode": "|cffecf0ff",
    "rgbHex": "#ecf0ff",
    "rgb": [
      236,
      240,
      255
    ]
  },
  {
    "sourceKey": "22",
    "index": 22,
    "name": "Emerald",
    "sourceCode": "|cff00781e",
    "rgbHex": "#00781e",
    "rgb": [
      0,
      120,
      30
    ]
  },
  {
    "sourceKey": "23",
    "index": 23,
    "name": "Peanut",
    "sourceCode": "|cffa56f34",
    "rgbHex": "#a56f34",
    "rgb": [
      165,
      111,
      52
    ]
  },
  {
    "sourceKey": "Neutral Hostile",
    "index": null,
    "name": "Black",
    "sourceCode": "|cff2e2d2e",
    "rgbHex": "#2e2d2e",
    "rgb": [
      46,
      45,
      46
    ]
  }
].map(row => Object.freeze({...row, rgb: Object.freeze(row.rgb)})));
