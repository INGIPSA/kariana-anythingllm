import useLoginMode from "@/hooks/useLoginMode";
import usePfp from "@/hooks/usePfp";
import useUser from "@/hooks/useUser";
import System from "@/models/system";
import paths from "@/utils/paths";
import { userFromStorage } from "@/utils/request";
import {
  Person,
  Headset,
  CreditCard,
  Sliders,
} from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import AccountModal from "../AccountModal";
import {
  AUTH_TIMESTAMP,
  AUTH_TOKEN,
  AUTH_USER,
  LAST_VISITED_WORKSPACE,
  USER_PROMPT_INPUT_MAP,
} from "@/utils/constants";
import { useTranslation } from "react-i18next";
import { useClerkConfig } from "@/ClerkProviderWrapper";
import { UserButton as ClerkUserButton } from "@clerk/clerk-react";

export default function UserButton() {
  const { clerkEnabled } = useClerkConfig();
  const mode = useLoginMode();

  if (mode === null) return null;

  if (clerkEnabled) {
    return <ClerkUserMenu />;
  }

  return <LegacyUserMenu mode={mode} />;
}

/**
 * Clerk-powered user menu with avatar, account management, and custom links.
 * Clerk handles sign-out, account settings, and avatar automatically.
 * "App Settings" opens the legacy AccountModal for KARIANA-specific preferences
 * (profile picture, username, bio, theme, language, STT/TTS toggles).
 */
function ClerkUserMenu() {
  const { user } = useUser();
  const [supportEmail, setSupportEmail] = useState("");
  const [showAccountSettings, setShowAccountSettings] = useState(false);

  useEffect(() => {
    const fetchSupportEmail = async () => {
      const result = await System.fetchSupportEmail();
      setSupportEmail(
        result?.email ? `mailto:${result.email}` : "mailto:business@kariana.ai"
      );
    };
    fetchSupportEmail();
  }, []);

  return (
    <div className="absolute top-3 right-4 md:top-9 md:right-10 w-fit h-fit z-40">
      <style>{`
        .cl-userButtonPopoverCard [role="menuitem"] {
          color: #E8E8E9 !important;
        }
        .cl-userButtonPopoverCard [role="menuitem"] svg {
          color: #B0B0B1 !important;
          opacity: 1 !important;
        }
        .cl-userButtonPopoverCard [role="menuitem"]:hover {
          color: #E8E8E9 !important;
          background-color: #2A2627 !important;
        }
        .cl-userButtonPopoverCard [role="menuitem"]:hover svg {
          color: #FF7EDC !important;
        }
      `}</style>
      <ClerkUserButton
        afterSignOutUrl="/login"
        appearance={{
          elements: {
            avatarBox: "w-[35px] h-[35px]",
            userButtonPopoverCard:
              "bg-[#231F20] border border-[#3A3637] shadow-xl",
            userButtonPopoverFooter: "hidden",
          },
        }}
      >
        <ClerkUserButton.MenuItems>
          <ClerkUserButton.Action
            label="App Settings"
            labelIcon={<Sliders size={16} />}
            onClick={() => setShowAccountSettings(true)}
          />
          <ClerkUserButton.Link
            label="Support"
            labelIcon={<Headset size={16} />}
            href={supportEmail}
          />
          <ClerkUserButton.Link
            label="Billing"
            labelIcon={<CreditCard size={16} />}
            href="/pricing"
          />
          <ClerkUserButton.Action label="manageAccount" />
          <ClerkUserButton.Action label="signOut" />
        </ClerkUserButton.MenuItems>
      </ClerkUserButton>
      {user && showAccountSettings && (
        <AccountModal
          user={user}
          hideModal={() => setShowAccountSettings(false)}
        />
      )}
    </div>
  );
}

/**
 * Legacy user menu for non-Clerk mode (original AnythingLLM behavior).
 */
function LegacyUserMenu({ mode }) {
  const { t } = useTranslation();
  const { user } = useUser();
  const menuRef = useRef();
  const buttonRef = useRef();
  const [showMenu, setShowMenu] = useState(false);
  const [showAccountSettings, setShowAccountSettings] = useState(false);
  const [supportEmail, setSupportEmail] = useState("");

  const handleClose = (event) => {
    if (
      menuRef.current &&
      !menuRef.current.contains(event.target) &&
      !buttonRef.current.contains(event.target)
    ) {
      setShowMenu(false);
    }
  };

  const handleOpenAccountModal = () => {
    setShowAccountSettings(true);
    setShowMenu(false);
  };

  useEffect(() => {
    if (showMenu) {
      document.addEventListener("mousedown", handleClose);
    }
    return () => document.removeEventListener("mousedown", handleClose);
  }, [showMenu]);

  useEffect(() => {
    const fetchSupportEmail = async () => {
      const supportEmail = await System.fetchSupportEmail();
      setSupportEmail(
        supportEmail?.email
          ? `mailto:${supportEmail.email}`
          : paths.mailToMintplex()
      );
    };
    fetchSupportEmail();
  }, []);

  return (
    <div className="absolute top-3 right-4 md:top-9 md:right-10 w-fit h-fit z-40">
      <button
        ref={buttonRef}
        onClick={() => setShowMenu(!showMenu)}
        type="button"
        className="uppercase transition-all duration-300 w-[35px] h-[35px] text-base font-semibold rounded-full flex items-center bg-theme-action-menu-bg hover:bg-theme-action-menu-item-hover justify-center text-white p-2 hover:border-slate-100 hover:border-opacity-50 border-transparent border"
      >
        {mode === "multi" ? <UserDisplay /> : <Person size={14} />}
      </button>

      {showMenu && (
        <div
          ref={menuRef}
          className="w-fit rounded-lg absolute top-12 right-0 bg-theme-action-menu-bg p-2 flex items-center-justify-center"
        >
          <div className="flex flex-col gap-y-2">
            {mode === "multi" && !!user && (
              <button
                onClick={handleOpenAccountModal}
                className="border-none text-white hover:bg-theme-action-menu-item-hover w-full text-left px-4 py-1.5 rounded-md"
              >
                {t("profile_settings.account")}
              </button>
            )}
            <a
              href={supportEmail}
              className="text-white hover:bg-theme-action-menu-item-hover w-full text-left px-4 py-1.5 rounded-md"
            >
              {t("profile_settings.support")}
            </a>
            <button
              onClick={() => {
                window.localStorage.removeItem(AUTH_USER);
                window.localStorage.removeItem(AUTH_TOKEN);
                window.localStorage.removeItem(AUTH_TIMESTAMP);
                window.localStorage.removeItem(LAST_VISITED_WORKSPACE);
                window.localStorage.removeItem(USER_PROMPT_INPUT_MAP);
                window.location.replace(paths.home());
              }}
              type="button"
              className="text-white hover:bg-theme-action-menu-item-hover w-full text-left px-4 py-1.5 rounded-md"
            >
              {t("profile_settings.signout")}
            </button>
          </div>
        </div>
      )}
      {user && showAccountSettings && (
        <AccountModal
          user={user}
          hideModal={() => setShowAccountSettings(false)}
        />
      )}
    </div>
  );
}

function UserDisplay() {
  const { pfp } = usePfp();
  const user = userFromStorage();

  if (pfp) {
    return (
      <div className="w-[35px] h-[35px] rounded-full flex-shrink-0 overflow-hidden transition-all duration-300 bg-gray-100 hover:border-slate-100 hover:border-opacity-50 border-transparent border hover:opacity-60">
        <img
          src={pfp}
          alt="User profile picture"
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  return user?.username?.slice(0, 2) || "AA";
}
