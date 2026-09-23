const MAX_FRAME = 12;

const FRAMES = [
  require("../../assets/profile/frame_00.png"),
  require("../../assets/profile/frame_01.png"),
  require("../../assets/profile/frame_02.png"),
  require("../../assets/profile/frame_03.png"),
  require("../../assets/profile/frame_04.png"),
  require("../../assets/profile/frame_05.png"),
  require("../../assets/profile/frame_06.png"),
  require("../../assets/profile/frame_07.png"),
  require("../../assets/profile/frame_08.png"),
  require("../../assets/profile/frame_09.png"),
  require("../../assets/profile/frame_10.png"),
  require("../../assets/profile/frame_11.png"),
  require("../../assets/profile/frame_12.png"),
];

export function profileFrameIndex(badgeCount) {
  if (typeof badgeCount !== "number" || !Number.isInteger(badgeCount) || badgeCount < 0) {
    return 0;
  }
  if (badgeCount > MAX_FRAME) return MAX_FRAME;
  return badgeCount;
}

export function getProfileFrame(badgeCount) {
  return FRAMES[profileFrameIndex(badgeCount)];
}
