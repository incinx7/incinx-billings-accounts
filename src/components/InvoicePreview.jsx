import { buildInvHTML } from '../lib/invoiceHtml.js';

export default function InvoicePreview({ data, settings }) {
  return <div dangerouslySetInnerHTML={{ __html: buildInvHTML(data, settings) }} />;
}