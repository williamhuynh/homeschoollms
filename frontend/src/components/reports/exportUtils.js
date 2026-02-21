/**
 * Preferred display order for learning area subjects in reports.
 * Subjects matching earlier entries appear first; unmatched subjects
 * appear at the end in their original order.
 */
const SUBJECT_DISPLAY_ORDER = [
  { codes: ['ENG'], names: ['english'] },
  { codes: ['MAT', 'MATH'], names: ['mathematics'] },
  { codes: ['SCI', 'STE'], names: ['science'] },
  { codes: ['HSIE', 'HSE'], names: ['human society', 'geography', 'history'] },
  { codes: ['CRA', 'CART'], names: ['creative arts'] },
  { codes: ['PDH', 'PHE'], names: ['personal development', 'pdhpe'] },
]

function subjectSortKey(summary) {
  const code = (summary.learning_area_code || '').toUpperCase()
  const name = (summary.learning_area_name || '').toLowerCase()

  for (let i = 0; i < SUBJECT_DISPLAY_ORDER.length; i++) {
    const entry = SUBJECT_DISPLAY_ORDER[i]
    for (const c of entry.codes) {
      if (code === c || code.startsWith(c)) return i
    }
    for (const n of entry.names) {
      if (name.includes(n)) return i
    }
  }
  return SUBJECT_DISPLAY_ORDER.length
}

/**
 * Sort learning area summaries into the preferred display order:
 * English, Mathematics, Science & Technology, HSIE, Creative Arts, PDHPE, then everything else.
 */
export function sortLearningAreaSummaries(summaries) {
  if (!summaries) return summaries
  return [...summaries].sort((a, b) => subjectSortKey(a) - subjectSortKey(b))
}

export const formatReportPeriod = (period, customName) => {
  if (period === 'custom' && customName) {
    return customName;
  }
  const periodMap = {
    annual: 'Annual Report',
    term_1: 'Term 1 Report',
    term_2: 'Term 2 Report',
    term_3: 'Term 3 Report',
    term_4: 'Term 4 Report',
  };
  return periodMap[period] || period;
};

export const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString('en-AU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

/**
 * Converts markdown formatting to HTML.
 * Supports **bold**, *italic*, and preserves line breaks.
 * Escapes HTML entities first to prevent XSS.
 */
export const formatMarkdownToHTML = (text) => {
  if (!text) return '';

  // Escape HTML entities first to prevent XSS
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  // Convert markdown to HTML
  // Bold first: **text** -> <strong>text</strong>
  // Then italic: *text* -> <em>text</em>
  // Order matters - bold markers are removed first so italic regex won't match them
  return escaped
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');
};

export const generatePrintableHTML = (report, student) => {
  const printStyles = `
      <style>
        @page {
          margin: 2cm;
          size: A4;
        }
        
        /* Base styles - apply to both browser and print */
        body {
          font-family: 'Arial', sans-serif;
          line-height: 1.6;
          color: #333;
          background: white;
        }
        
        .report-container {
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
        }
        
        .header {
          text-align: center;
          margin-bottom: 40px;
          border-bottom: 2px solid #4299e1;
          padding-bottom: 20px;
        }
        
        .meta-info {
          background: #f8f9fa;
          padding: 15px;
          border-radius: 8px;
          margin-bottom: 30px;
        }
        
        .overall-summary {
          background: #ebf8ff;
          padding: 20px;
          border-radius: 8px;
          margin-bottom: 30px;
        }
        
        .learning-area {
          margin-bottom: 30px;
          border: 1px solid #e2e8f0;
          padding: 20px;
          border-radius: 8px;
        }
        
        .progress-bar {
          height: 8px;
          background: #f0f0f0;
          border-radius: 4px;
          overflow: hidden;
          margin: 10px 0;
        }
        
        .progress-fill {
          height: 100%;
          background: #48bb78;
        }
        
        .summary-text {
          white-space: pre-wrap;
          margin: 15px 0;
          padding: 15px;
          background: #f8f9fa;
          border-left: 4px solid #4299e1;
        }
        
        .evidence-gallery {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
          margin: 15px 0;
        }
        
        .evidence-item {
          height: 120px;
          border: 1px solid #ccc;
          border-radius: 4px;
          overflow: hidden;
          background: #f0f0f0;
        }
        
        .evidence-item img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        
        /* Print-specific overrides */
        @media print {
          body {
            background: white !important;
          }
          
          .no-print {
            display: none !important;
          }
          
          .page-break {
            page-break-before: always;
          }
          
          .learning-area {
            break-inside: avoid;
          }
        }
      </style>
    `;

  const reportHTML = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>${formatReportPeriod(report.report_period, report.custom_period_name)} - ${student?.first_name} ${student?.last_name}</title>
          ${printStyles}
        </head>
        <body>
          <div class="report-container">
            <!-- Header -->
            <div class="header">
              <h1>${formatReportPeriod(report.report_period, report.custom_period_name)}</h1>
              <h2>${student?.first_name} ${student?.last_name}</h2>
              <p><strong>Grade Level:</strong> ${report.grade_level || student?.grade_level}</p>
              <p><strong>Created:</strong> ${formatDate(report.generated_at)}</p>
            </div>

            <!-- Report Metadata -->
            <div class="meta-info">
              <h3>Report Overview</h3>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                <div>
                  <strong>Total Evidence Collected:</strong> ${report.learning_area_summaries?.reduce((acc, summary) => acc + summary.evidence_count, 0) || 0}
                </div>
                <div>
                  <strong>Learning Outcomes Achieved:</strong> ${report.learning_area_summaries?.reduce((acc, summary) => acc + summary.outcomes_with_evidence, 0) || 0} / ${report.learning_area_summaries?.reduce((acc, summary) => acc + summary.total_outcomes, 0) || 0}
                </div>
              </div>
            </div>

            ${(report.parent_overview || report.ai_generated_overview) ? `
            <!-- Overview Section -->
            <div class="overall-summary" style="background: #f0fff4; border-left: 4px solid #48bb78;">
              <h3 style="color: #276749; margin-bottom: 10px;">Overview</h3>
              <p style="white-space: pre-wrap; color: #2f855a;">${(report.parent_overview || report.ai_generated_overview || '').replace(/\n/g, '<br>')}</p>
            </div>
            ` : ''}

            <!-- Learning Area Summaries -->
            <div>
              <h2>Learning Area Progress</h2>
              ${sortLearningAreaSummaries(report.learning_area_summaries)?.map(summary => `
                <div class="learning-area">
                  <h3>${summary.learning_area_name}</h3>
                  
                  <div style="margin: 15px 0;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                      <span>Progress</span>
                      <span><strong>${Math.round(summary.progress_percentage)}%</strong></span>
                    </div>
                    <div class="progress-bar">
                      <div class="progress-fill" style="width: ${summary.progress_percentage}%"></div>
                    </div>
                    <div style="font-size: 0.9em; color: #666; margin-top: 5px;">
                      ${summary.evidence_count} evidence items • ${summary.outcomes_with_evidence}/${summary.total_outcomes} outcomes achieved
                    </div>
                  </div>

                  <div class="summary-text">
                    ${formatMarkdownToHTML(summary.user_edited_summary || summary.ai_generated_summary || 'No summary available.')}
                  </div>

                  ${summary.evidence_examples?.length > 0 ? `
                    <div>
                      <h4>Evidence (${summary.evidence_count} total)</h4>
                      <div class="evidence-gallery">
                        ${summary.evidence_examples.map(evidence => `
                          <div class="evidence-item">
                            ${evidence.thumbnail_url ? 
                              `<img src="${evidence.thumbnail_url}" alt="${evidence.title}" />` : 
                              '<div style="display: flex; align-items: center; justify-content: center; height: 100%; background: #f0f0f0; font-size: 12px; color: #999;">No Image</div>'
                            }
                          </div>
                        `).join('')}
                      </div>
                    </div>
                  ` : ''}
                </div>
              `).join('') || '<p>No learning area summaries available.</p>'}
            </div>

            <!-- Footer -->
            <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center; color: #666; font-size: 0.9em;">
              <p>Generated by Homeschool LMS on ${formatDate(new Date().toISOString())}</p>
              <p>This report summarizes learning progress for Grade ${report.grade_level || student?.grade_level}.</p>
            </div>
          </div>
        </body>
      </html>
    `;

  return reportHTML;
};