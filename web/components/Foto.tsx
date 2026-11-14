// Foto real con su crédito. Las fotos son de Wikimedia Commons con licencia libre (CC BY-SA):
// la licencia pide nombrar al autor, la licencia y la fuente, así que el pie va siempre.

type Props = {
  src: string;
  alt: string;
  ancho: number;
  alto: number;
  pie: string;
  autor: string;
  licencia: string;
  licenciaUrl: string;
  fuente: string;
};

export default function Foto({ src, alt, ancho, alto, pie, autor, licencia, licenciaUrl, fuente }: Props) {
  return (
    <figure className="foto">
      <img src={src} alt={alt} width={ancho} height={alto} loading="lazy" decoding="async" />
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
