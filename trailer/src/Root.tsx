import { Composition } from "remotion";
import { Trailer } from "./trailer/Trailer";
import { DURATION, FPS } from "./trailer/timing";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition id="AuralisTrailer" component={Trailer} durationInFrames={DURATION} fps={FPS} width={1920} height={1080} />
  );
};
