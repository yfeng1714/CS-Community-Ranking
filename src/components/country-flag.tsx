import { countryFlagEmoji } from "@/domain/public/country-flag";

export function CountryFlag({
  code,
  missingLabel = "国籍待补",
}: {
  code: string | null;
  missingLabel?: string;
}) {
  if (!code) {
    return <span className="country-flag country-flag--missing">{missingLabel}</span>;
  }

  const emoji = countryFlagEmoji(code);
  return (
    <span className="country-flag" title={code}>
      {emoji ? (
        <span aria-hidden="true" className="country-flag__emoji">
          {emoji}
        </span>
      ) : (
        <span aria-hidden="true">{code}</span>
      )}
      <span className="sr-only">{code}</span>
    </span>
  );
}
