import {
  Button,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  useToast,
  VStack,
  Text,
  Box,
  Divider,
  HStack,
  Image,
  Grid,
  Heading,
  Progress,
  Badge
} from '@chakra-ui/react'
import { Download, Printer, FileText, Share2, ChevronDown } from 'react-feather'
import { useState } from 'react'

const ReportExporter = ({ report, student, className = '' }) => {
  const toast = useToast()
  const [exporting, setExporting] = useState(false)

  const formatReportPeriod = (period, customName) => {
    if (period === 'custom' && customName) {
      return customName
    }
    const periodMap = {
      'annual': 'Annual Report',
      'term_1': 'Term 1 Report',
      'term_2': 'Term 2 Report',
      'term_3': 'Term 3 Report',
      'term_4': 'Term 4 Report'
    }
    return periodMap[period] || period
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString('en-AU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const generatePrintableHTML = () => {
    const printStyles = `
      <style>
        @page {
          margin: 2cm;
          size: A4;
        }
        
        @media print {
          body {
            font-family: 'Arial', sans-serif;
            line-height: 1.6;
            color: #333;
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
            margin-bottom: 30px;
            border: 1px solid #e2e8f0;
            padding: 20px;
            border-radius: 8px;
          }
          
          .evidence-gallery {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            margin: 15px 0;
          }
          
          .evidence-item {
            width: 80px;
            height: 80px;
            border: 1px solid #ccc;
            border-radius: 4px;
            overflow: hidden;
          }
          
          .evidence-item img {
            width: 100%;
            height: 100%;
            object-fit: cover;
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
          
          .header {
            text-align: center;
            margin-bottom: 40px;
            border-bottom: 2px solid #4299e1;
            padding-bottom: 20px;
          }
          
          .summary-text {
            white-space: pre-wrap;
            margin: 15px 0;
            padding: 15px;
            background: #f8f9fa;
            border-left: 4px solid #4299e1;
          }
        }
        
        .report-container {
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
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
      </style>
    `

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
              <p><strong>Grade Level:</strong> ${student?.grade_level} | <strong>Academic Year:</strong> ${report.academic_year}</p>
              <p><strong>Generated:</strong> ${formatDate(report.generated_at)}</p>
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

            <!-- Learning Area Summaries -->
            <div>
              <h2>Learning Area Progress</h2>
              ${report.learning_area_summaries?.map(summary => `
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
                    ${(summary.user_edited_summary || summary.ai_generated_summary || 'No summary available.').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>')}
                  </div>

                  ${summary.evidence_examples?.length > 0 ? `
                    <div>
                      <h4>Evidence Examples</h4>
                      <div class="evidence-gallery">
                        ${summary.evidence_examples.slice(0, 6).map(evidence => `
                          <div class="evidence-item">
                            ${evidence.thumbnail_url ? 
                              `<img src="${evidence.thumbnail_url}" alt="${evidence.title}" />` : 
                              '<div style="display: flex; align-items: center; justify-content: center; height: 100%; background: #f0f0f0; font-size: 12px; color: #999;">No Image</div>'
                            }
                          </div>
                        `).join('')}
                      </div>
                      <p style="font-size: 0.9em; color: #666; margin-top: 10px;">
                        Sample evidence from ${summary.learning_area_name} activities.
                      </p>
                    </div>
                  ` : ''}
                </div>
              `).join('') || '<p>No learning area summaries available.</p>'}
            </div>

            <!-- Footer -->
            <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center; color: #666; font-size: 0.9em;">
              <p>Generated by Homeschool LMS on ${formatDate(new Date().toISOString())}</p>
              <p>This report summarizes learning progress for the ${report.academic_year} academic year.</p>
            </div>
          </div>
        </body>
      </html>
    `

    return reportHTML
  }

  const handlePrint = () => {
    try {
      const printWindow = window.open('', '_blank')
      if (!printWindow) {
        toast({
          title: 'Print blocked',
          description: 'Please allow pop-ups to print the report',
          status: 'error',
          duration: 3000,
          isClosable: true,
        })
        return
      }

      const htmlContent = generatePrintableHTML()
      printWindow.document.write(htmlContent)
      printWindow.document.close()
      
      // Wait for content to load then print
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print()
          printWindow.close()
        }, 500)
      }
    } catch (error) {
      console.error('Print error:', error)
      toast({
        title: 'Print failed',
        description: 'Unable to open print dialog',
        status: 'error',
        duration: 3000,
        isClosable: true,
      })
    }
  }

  const handleDownloadHTML = () => {
    try {
      const htmlContent = generatePrintableHTML()
      const blob = new Blob([htmlContent], { type: 'text/html' })
      const url = URL.createObjectURL(blob)
      
      const link = document.createElement('a')
      link.href = url
      link.download = `${student?.first_name}_${student?.last_name}_${report.report_period}_${report.academic_year}.html`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      toast({
        title: 'Report downloaded',
        description: 'HTML report saved to your downloads',
        status: 'success',
        duration: 2000,
        isClosable: true,
      })
    } catch (error) {
      console.error('Download error:', error)
      toast({
        title: 'Download failed',
        description: 'Unable to download report',
        status: 'error',
        duration: 3000,
        isClosable: true,
      })
    }
  }

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${formatReportPeriod(report.report_period, report.custom_period_name)} - ${student?.first_name} ${student?.last_name}`,
          text: `Educational progress report for ${student?.first_name} ${student?.last_name}`,
          url: window.location.href
        })
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error('Share error:', error)
        }
      }
    } else {
      // Fallback: copy link to clipboard
      try {
        await navigator.clipboard.writeText(window.location.href)
        toast({
          title: 'Link copied',
          description: 'Report link copied to clipboard',
          status: 'success',
          duration: 2000,
          isClosable: true,
        })
      } catch (error) {
        toast({
          title: 'Share failed',
          description: 'Unable to share report',
          status: 'error',
          duration: 3000,
          isClosable: true,
        })
      }
    }
  }

  return (
    <Menu>
      <MenuButton 
        as={Button} 
        rightIcon={<ChevronDown size={16} />}
        leftIcon={<Download size={16} />}
        variant="outline"
        size="sm"
        className={className}
        isLoading={exporting}
      >
        Export
      </MenuButton>
      <MenuList>
        <MenuItem 
          icon={<Printer size={16} />} 
          onClick={handlePrint}
        >
          Print Report
        </MenuItem>
        <MenuItem 
          icon={<Download size={16} />} 
          onClick={handleDownloadHTML}
        >
          Download HTML
        </MenuItem>
        <MenuItem 
          icon={<Share2 size={16} />} 
          onClick={handleShare}
        >
          Share Report
        </MenuItem>
      </MenuList>
    </Menu>
  )
}

export default ReportExporter 