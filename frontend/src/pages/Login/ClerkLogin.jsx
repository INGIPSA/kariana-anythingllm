import React from "react";
import { SignIn } from "@clerk/clerk-react";
import useLogo from "@/hooks/useLogo";

export default function ClerkLogin() {
  const { loginLogo, isCustomLogo } = useLogo();

  return (
    <div className="fixed inset-0 bg-[#231F20] flex items-center justify-center overflow-hidden">
      <div className="flex flex-col items-center">
        <div className="mb-8">
          <img
            src={loginLogo}
            alt="KARIANA-LLM"
            className={`max-h-[80px] ${isCustomLogo ? "rounded-lg" : ""}`}
            style={{ objectFit: "contain" }}
          />
        </div>
        <SignIn
          routing="hash"
          fallbackRedirectUrl="/"
          appearance={{
            elements: {
              rootBox: "w-full flex justify-center",
              card: "bg-[#2A2627] border border-[#3A3637] shadow-2xl rounded-xl",
            },
          }}
        />
      </div>
    </div>
  );
}
