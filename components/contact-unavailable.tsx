import type {Locale} from '@/content/types';

export function ContactUnavailable({locale}: {locale: Locale}) {
  return (
    <div className="demo-unavailable" role="status">
      <h2>
        {locale === 'es'
          ? 'El formulario de contacto aún no acepta mensajes'
          : 'Contact intake is not accepting messages yet'}
      </h2>
      <p>
        {locale === 'es'
          ? 'La protección contra abuso y la entrega verificada todavía se están configurando. Vuelve después de la apertura y no envíes datos estudiantiles, contraseñas ni información de cuenta por otro canal.'
          : 'Abuse protection and verified delivery are still being configured. Please return after launch, and do not send student data, passwords, or account information through another channel.'}
      </p>
    </div>
  );
}
