import type { LevelData } from './types';

// Locked-in canonical layouts, snapshotted from the original procedural
// generator (room densities 0.2-0.44, seeded variants). Do not regenerate.
export const BUILTIN_LEVELS: LevelData[] = [
  {
    "id": "builtin-1",
    "name": "Dungeon Room 1",
    "builtin": true,
    "entrance": "bottom",
    "exit": "top",
    "blocks": [
      {
        "col": 15,
        "row": 1,
        "w": 1,
        "h": 1
      },
      {
        "col": 1,
        "row": 2,
        "w": 1,
        "h": 1
      },
      {
        "col": 4,
        "row": 2,
        "w": 1,
        "h": 1
      },
      {
        "col": 14,
        "row": 3,
        "w": 2,
        "h": 2
      },
      {
        "col": 1,
        "row": 4,
        "w": 1,
        "h": 1
      },
      {
        "col": 4,
        "row": 4,
        "w": 2,
        "h": 2
      },
      {
        "col": 17,
        "row": 4,
        "w": 1,
        "h": 1
      },
      {
        "col": 7,
        "row": 5,
        "w": 1,
        "h": 1
      },
      {
        "col": 9,
        "row": 6,
        "w": 2,
        "h": 2
      },
      {
        "col": 14,
        "row": 6,
        "w": 1,
        "h": 1
      },
      {
        "col": 18,
        "row": 6,
        "w": 1,
        "h": 1
      },
      {
        "col": 4,
        "row": 7,
        "w": 2,
        "h": 2
      },
      {
        "col": 2,
        "row": 10,
        "w": 1,
        "h": 1
      },
      {
        "col": 17,
        "row": 10,
        "w": 1,
        "h": 1
      },
      {
        "col": 5,
        "row": 11,
        "w": 1,
        "h": 1
      },
      {
        "col": 15,
        "row": 11,
        "w": 1,
        "h": 1
      }
    ],
    "enemies": [
      {
        "type": "green",
        "x": 913,
        "y": 109
      }
    ]
  },
  {
    "id": "builtin-2",
    "name": "Dungeon Room 2",
    "builtin": true,
    "entrance": "left",
    "exit": "right",
    "blocks": [
      {
        "col": 8,
        "row": 1,
        "w": 1,
        "h": 1
      },
      {
        "col": 16,
        "row": 1,
        "w": 1,
        "h": 1
      },
      {
        "col": 11,
        "row": 2,
        "w": 1,
        "h": 1
      },
      {
        "col": 13,
        "row": 2,
        "w": 1,
        "h": 1
      },
      {
        "col": 7,
        "row": 3,
        "w": 2,
        "h": 2
      },
      {
        "col": 10,
        "row": 4,
        "w": 1,
        "h": 1
      },
      {
        "col": 12,
        "row": 5,
        "w": 1,
        "h": 1
      },
      {
        "col": 7,
        "row": 6,
        "w": 1,
        "h": 1
      },
      {
        "col": 11,
        "row": 7,
        "w": 1,
        "h": 1
      },
      {
        "col": 13,
        "row": 7,
        "w": 1,
        "h": 1
      },
      {
        "col": 7,
        "row": 8,
        "w": 1,
        "h": 1
      },
      {
        "col": 9,
        "row": 8,
        "w": 1,
        "h": 1
      },
      {
        "col": 14,
        "row": 9,
        "w": 1,
        "h": 1
      },
      {
        "col": 1,
        "row": 10,
        "w": 1,
        "h": 1
      },
      {
        "col": 3,
        "row": 10,
        "w": 1,
        "h": 1
      },
      {
        "col": 12,
        "row": 10,
        "w": 1,
        "h": 1
      },
      {
        "col": 9,
        "row": 11,
        "w": 1,
        "h": 1
      },
      {
        "col": 15,
        "row": 11,
        "w": 1,
        "h": 1
      },
      {
        "col": 17,
        "row": 11,
        "w": 1,
        "h": 1
      }
    ],
    "enemies": [
      {
        "type": "green",
        "x": 524,
        "y": 563
      },
      {
        "type": "red",
        "x": 503,
        "y": 269
      }
    ]
  },
  {
    "id": "builtin-3",
    "name": "Dungeon Room 3",
    "builtin": true,
    "entrance": "right",
    "exit": "bottom",
    "blocks": [
      {
        "col": 1,
        "row": 1,
        "w": 1,
        "h": 1
      },
      {
        "col": 5,
        "row": 1,
        "w": 1,
        "h": 1
      },
      {
        "col": 11,
        "row": 1,
        "w": 3,
        "h": 3
      },
      {
        "col": 17,
        "row": 1,
        "w": 1,
        "h": 1
      },
      {
        "col": 7,
        "row": 2,
        "w": 2,
        "h": 2
      },
      {
        "col": 15,
        "row": 2,
        "w": 1,
        "h": 1
      },
      {
        "col": 1,
        "row": 3,
        "w": 2,
        "h": 2
      },
      {
        "col": 5,
        "row": 3,
        "w": 1,
        "h": 1
      },
      {
        "col": 4,
        "row": 5,
        "w": 1,
        "h": 1
      },
      {
        "col": 6,
        "row": 5,
        "w": 1,
        "h": 1
      },
      {
        "col": 11,
        "row": 5,
        "w": 1,
        "h": 1
      },
      {
        "col": 2,
        "row": 6,
        "w": 1,
        "h": 1
      },
      {
        "col": 8,
        "row": 6,
        "w": 1,
        "h": 1
      },
      {
        "col": 13,
        "row": 6,
        "w": 2,
        "h": 2
      },
      {
        "col": 5,
        "row": 7,
        "w": 1,
        "h": 1
      },
      {
        "col": 11,
        "row": 7,
        "w": 1,
        "h": 1
      },
      {
        "col": 2,
        "row": 8,
        "w": 1,
        "h": 1
      },
      {
        "col": 14,
        "row": 9,
        "w": 1,
        "h": 1
      },
      {
        "col": 3,
        "row": 10,
        "w": 1,
        "h": 1
      },
      {
        "col": 5,
        "row": 10,
        "w": 1,
        "h": 1
      },
      {
        "col": 18,
        "row": 10,
        "w": 1,
        "h": 1
      },
      {
        "col": 1,
        "row": 11,
        "w": 1,
        "h": 1
      },
      {
        "col": 15,
        "row": 11,
        "w": 1,
        "h": 1
      }
    ],
    "enemies": [
      {
        "type": "green",
        "x": 367,
        "y": 205
      },
      {
        "type": "green",
        "x": 673,
        "y": 590
      },
      {
        "type": "red",
        "x": 459,
        "y": 231
      }
    ]
  },
  {
    "id": "builtin-4",
    "name": "Dungeon Room 4",
    "builtin": true,
    "entrance": "left",
    "exit": "bottom",
    "blocks": [
      {
        "col": 1,
        "row": 1,
        "w": 2,
        "h": 2
      },
      {
        "col": 5,
        "row": 1,
        "w": 1,
        "h": 1
      },
      {
        "col": 7,
        "row": 1,
        "w": 1,
        "h": 1
      },
      {
        "col": 10,
        "row": 1,
        "w": 2,
        "h": 2
      },
      {
        "col": 15,
        "row": 1,
        "w": 2,
        "h": 2
      },
      {
        "col": 13,
        "row": 2,
        "w": 1,
        "h": 1
      },
      {
        "col": 5,
        "row": 3,
        "w": 1,
        "h": 1
      },
      {
        "col": 8,
        "row": 3,
        "w": 1,
        "h": 1
      },
      {
        "col": 18,
        "row": 3,
        "w": 1,
        "h": 1
      },
      {
        "col": 12,
        "row": 4,
        "w": 1,
        "h": 1
      },
      {
        "col": 15,
        "row": 4,
        "w": 1,
        "h": 1
      },
      {
        "col": 8,
        "row": 5,
        "w": 1,
        "h": 1
      },
      {
        "col": 5,
        "row": 6,
        "w": 2,
        "h": 2
      },
      {
        "col": 11,
        "row": 6,
        "w": 2,
        "h": 2
      },
      {
        "col": 16,
        "row": 6,
        "w": 1,
        "h": 1
      },
      {
        "col": 14,
        "row": 7,
        "w": 1,
        "h": 1
      },
      {
        "col": 18,
        "row": 7,
        "w": 1,
        "h": 1
      },
      {
        "col": 5,
        "row": 9,
        "w": 1,
        "h": 1
      },
      {
        "col": 14,
        "row": 9,
        "w": 1,
        "h": 1
      },
      {
        "col": 2,
        "row": 10,
        "w": 2,
        "h": 2
      },
      {
        "col": 16,
        "row": 10,
        "w": 2,
        "h": 2
      },
      {
        "col": 5,
        "row": 11,
        "w": 1,
        "h": 1
      }
    ],
    "enemies": [
      {
        "type": "green",
        "x": 810,
        "y": 369
      },
      {
        "type": "green",
        "x": 509,
        "y": 250
      },
      {
        "type": "red",
        "x": 916,
        "y": 45
      },
      {
        "type": "red",
        "x": 844,
        "y": 159
      }
    ]
  },
  {
    "id": "builtin-5",
    "name": "Dungeon Room 5",
    "builtin": true,
    "entrance": "right",
    "exit": "left",
    "blocks": [
      {
        "col": 1,
        "row": 1,
        "w": 1,
        "h": 1
      },
      {
        "col": 9,
        "row": 1,
        "w": 2,
        "h": 2
      },
      {
        "col": 14,
        "row": 1,
        "w": 1,
        "h": 1
      },
      {
        "col": 16,
        "row": 1,
        "w": 1,
        "h": 1
      },
      {
        "col": 3,
        "row": 2,
        "w": 1,
        "h": 1
      },
      {
        "col": 18,
        "row": 2,
        "w": 1,
        "h": 1
      },
      {
        "col": 6,
        "row": 3,
        "w": 1,
        "h": 1
      },
      {
        "col": 12,
        "row": 3,
        "w": 2,
        "h": 2
      },
      {
        "col": 10,
        "row": 4,
        "w": 1,
        "h": 1
      },
      {
        "col": 5,
        "row": 6,
        "w": 1,
        "h": 1
      },
      {
        "col": 7,
        "row": 6,
        "w": 1,
        "h": 1
      },
      {
        "col": 9,
        "row": 6,
        "w": 2,
        "h": 2
      },
      {
        "col": 12,
        "row": 7,
        "w": 2,
        "h": 2
      },
      {
        "col": 5,
        "row": 8,
        "w": 2,
        "h": 2
      },
      {
        "col": 10,
        "row": 9,
        "w": 1,
        "h": 1
      },
      {
        "col": 1,
        "row": 10,
        "w": 1,
        "h": 1
      },
      {
        "col": 5,
        "row": 11,
        "w": 1,
        "h": 1
      },
      {
        "col": 11,
        "row": 11,
        "w": 1,
        "h": 1
      },
      {
        "col": 13,
        "row": 11,
        "w": 1,
        "h": 1
      },
      {
        "col": 17,
        "row": 11,
        "w": 1,
        "h": 1
      }
    ],
    "enemies": [
      {
        "type": "green",
        "x": 45,
        "y": 236
      },
      {
        "type": "green",
        "x": 220,
        "y": 192
      },
      {
        "type": "red",
        "x": 602,
        "y": 90
      },
      {
        "type": "red",
        "x": 78,
        "y": 388
      },
      {
        "type": "red",
        "x": 449,
        "y": 180
      }
    ]
  }
] as LevelData[];
