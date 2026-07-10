import { buildQuotationHTML } from '../lib/quotationHtml.js';

export default function QuotationPreview({ data, settings }) {
  return <div dangerouslySetInnerHTML={{ __html: buildQuotationHTML(data, settings) }} />;
}
