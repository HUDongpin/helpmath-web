export function Brand({
  homeHref,
  homeLabel,
}: {
  homeHref: string;
  homeLabel: string;
}) {
  return (
    <a className="brand" href={homeHref} title={homeLabel}>
      <span aria-hidden="true" className="brand__mark">
        <span>+</span>
        <span>×</span>
      </span>
      <span className="brand__name">
        HELP <strong>Math</strong>
      </span>
    </a>
  );
}
