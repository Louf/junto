import { AccountButton } from "./AccountButton";
import { ThemeMenu } from "./ThemeMenu";

/** The top-right cluster every page shares: account, then theme. */
export function HeaderActions({
  hideSignInWhenSignedOut = false,
}: {
  hideSignInWhenSignedOut?: boolean;
}) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      <AccountButton hideWhenSignedOut={hideSignInWhenSignedOut} />
      <ThemeMenu />
    </div>
  );
}
