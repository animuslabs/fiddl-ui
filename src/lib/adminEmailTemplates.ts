import axios from "axios"

export interface AdminEmailTemplateDetail {
  id: string
  key: string
  name: string
  description: string | null
  subject: string
  bodyMarkdown: string
  metadataJson: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
}

export interface AdminEmailTemplateDetailResponse {
  template: AdminEmailTemplateDetail
}

export interface AdminEmailTemplateUpdateBody {
  id: string
  subject: string
  bodyMarkdown: string
  description?: string | null
  metadataJson?: Record<string, unknown> | null
}

export interface AdminEmailTemplateUpdateResponse {
  ok: boolean
  template: AdminEmailTemplateDetail
}

export async function fetchAdminEmailTemplate(templateId: string) {
  const res = await axios.get<AdminEmailTemplateDetailResponse>("/admin/emailTemplateDetail", {
    params: { templateId },
  })
  return res.data.template
}

export async function updateAdminEmailTemplate(payload: AdminEmailTemplateUpdateBody) {
  const res = await axios.post<AdminEmailTemplateUpdateResponse>("/admin/emailTemplateUpdate", payload)
  return res.data
}
