import {Container} from '@/components/ui';
import {Link} from '@/i18n/navigation';

export default function NotFound() {
  return (
    <main className="page-hero page-hero--yellow" id="main-content">
      <Container>
        <div className="page-hero__copy">
          <p className="eyebrow">404</p>
          <h1>Page not found</h1>
          <p>The page you requested is not part of the HELP Math website.</p>
          <div className="page-hero__actions">
            <Link className="action action--primary" href="/">Return home</Link>
          </div>
        </div>
      </Container>
    </main>
  );
}
