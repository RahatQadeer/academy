"use client";

import { useState } from "react";
import { COMPLETION_CERTIFICATE } from "../lib/certificateConfig";

const INK = "#0e2b5b";

export function CertificateSignature() {
  const [missing, setMissing] = useState(false);

  return (
    <div className="relative" style={{ height: 54, width: "100%", maxWidth: 210 }}>
      {!missing ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={COMPLETION_CERTIFICATE.signatureImagePath}
          alt=""
          className="absolute bottom-[8px] left-0 z-[1] h-[42px] w-auto max-w-full object-contain object-left"
          onError={() => setMissing(true)}
        />
      ) : null}
      <div
        className="absolute bottom-0 left-0"
        style={{ height: 1, width: "88%", maxWidth: 200, background: INK }}
      />
    </div>
  );
}
