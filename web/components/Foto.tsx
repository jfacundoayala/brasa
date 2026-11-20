// Foto real con su crédito. Las fotos son de Wikimedia Commons con licencia libre (CC BY-SA):
// la licencia pide nombrar al autor, la licencia y la fuente, así que el pie va siempre.

type Props = {
  src: string;
  /** Versión de 640 px de ancho, para pantallas chicas. */
  chica?: string;
  alt: string;
  ancho: number;
  alto: number;
  pie: string;
  autor: string;
  licencia: string;
  licenciaUrl: string;
  fuente: string;
};

export default function Foto({ src, chica, alt, ancho, alto, pie, autor, licencia, licenciaUrl, fuente }: Props) {
  return (
    <figure className="foto">
      <img
        src={src}
        srcSet={chica ? `${chica} 640w, ${src} ${ancho}w` : undefined}
        sizes={chica ? "(max-width: 768px) 92vw, 560px" : undefined}
        alt={alt}
        width={ancho}
        height={alto}
        loading="lazy"
        decoding="async"
      />
      <figcaption>
        {pie} Foto:{" "}
        <a href={fuente} target="_blank" rel="noreferrer">
          {autor}
        </a>{" "}
        (
        <a href={licenciaUrl} target="_blank" rel="noreferrer">
          {licencia}
        </a>
        ), adaptada.
      </figcaption>
    </figure>
  );
}
