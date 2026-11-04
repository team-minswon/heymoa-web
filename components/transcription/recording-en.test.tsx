import { render, screen } from "@testing-library/react";
import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";

import { intlWrapper } from "@/components/help/test-intl";
import { RecordingConnectionNotice } from "@/components/transcription/recording-connection-notice";
import { RecordingDegradedNotice } from "@/components/transcription/recording-degraded-notice";
import { RecordingPendingSpinner } from "@/components/transcription/recording-pending-spinner";
import { messagesFor } from "@/i18n/messages";
import {
  interruptedMessage,
  meetingEndedMessage,
  runtimeFailureMessage,
  startErrorMessage,
} from "@/lib/transcription/recording-messages";

const HANGUL = /[가-힣]/;

describe("녹음 영어 화면", () => {
  it("연결 알림·받아쓰기 멈춤·처리 중 표시가 영어로 그려진다", () => {
    const { container } = render(
      <>
        <RecordingConnectionNotice
          notice={{ cause: "disconnected", sinceMs: 1 }}
          buffer={null}
          microphone="ended"
          systemAudio="ended"
          finishing={false}
        />
        <RecordingDegradedNotice />
        <RecordingPendingSpinner />
      </>,
      { wrapper: intlWrapper("en") }
    );

    expect(
      screen.getByText(
        "Connection lost. Transcription and live analysis are paused. Recorded audio is held in this tab. Keep it open until you reconnect."
      )
    ).toBeTruthy();
    expect(screen.getByRole("status", { name: "Processing recording" })).toBeTruthy();
    expect(container.textContent).not.toMatch(HANGUL);
  });

  it("실패 문구가 영어 복수형으로 나온다", () => {
    const t = createTranslator({
      locale: "en",
      messages: messagesFor("en"),
      namespace: "recording.errors",
    });

    expect(meetingEndedMessage(t, 1_000)).toBe(
      "The meeting ended, so 1 second of audio left on this device couldn't be uploaded."
    );
    expect(runtimeFailureMessage(t, "resume_window_exhausted", 12_000)).toBe(
      "Recording stopped because the connection dropped. Couldn't upload 12 seconds of audio left on this device."
    );
    expect(interruptedMessage(t, null)).toBe(
      "The server stopped the transcription session."
    );
    expect(
      startErrorMessage(t, new DOMException("denied", "NotAllowedError"))
    ).toBe(
      "HeyMoa needs microphone access. Allow the microphone in your browser settings."
    );
  });
});
