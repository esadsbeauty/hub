declare module "opus-recorder" {
  export default class OpusRecorder {
    constructor(options?: {
      encoderPath?: string;
      encoderApplication?: number;
      encoderBitRate?: number;
      numberOfChannels?: number;
    });
    ondataavailable: (data: ArrayBuffer) => void;
    onstop: () => void;
    start(): Promise<void>;
    stop(): void;
    close(): void;
  }
}
