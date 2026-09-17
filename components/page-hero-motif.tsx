export function PageHeroMotif() {
  return (
    <div aria-hidden="true" className="page-hero__motif">
      <div className="motif-card motif-card--equation">8 × 4 = 32</div>
      <div className="motif-card motif-card--words">
        <span className="motif-words motif-words--en">eight groups of four</span>
        <span className="motif-words motif-words--es">ocho grupos de cuatro</span>
      </div>
      <div className="motif-grid">
        {Array.from({length: 12}, (_, index) => (
          <span className={index < 8 ? 'is-filled' : ''} key={index} />
        ))}
      </div>
      <span className="motif-symbol motif-symbol--plus">+</span>
      <span className="motif-symbol motif-symbol--divide">÷</span>
    </div>
  );
}
