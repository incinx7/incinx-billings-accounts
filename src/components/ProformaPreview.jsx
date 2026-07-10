import { buildProformaHTML } from '../lib/proformaHtml.js';

export default function ProformaPreview({ data, settings }) {
  return <div dangerouslySetInnerHTML={{ __html: buildProformaHTML(data, settings) }} />;
}
