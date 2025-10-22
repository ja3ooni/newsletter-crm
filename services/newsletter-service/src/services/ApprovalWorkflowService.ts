import {
    Approval,
    ApprovalStage,
    ApprovalWorkflow
} from '@/types'
import { database } from '@/utils/database'
import { logger } from '@/utils/logger'

export interface CreateApprovalWorkflowData {
  contentId: string
  stages: {
    name: string
    approvers: string[]
    requiredApprovals: number
    order: number
  }[]
}

export interface UpdateApprovalData {
  status: 'approved' | 'rejected' | 'revision_requested'
  comments?: string
}

export class ApprovalWorkflowService {
  async startWorkflow(contentId: string, createdBy: string): Promise<ApprovalWorkflow> {
    try {
      // Get default approval workflow configuration
      const stages = await this.getDefaultApprovalStages()

      const workflowData: CreateApprovalWorkflowData = {
        contentId,
        stages,
      }

      return await this.createWorkflow(workflowData, createdBy)
    } catch (error) {
      logger.error('Error starting approval workflow:', error)
      throw error
    }
  }

  async createWorkflow(data: CreateApprovalWorkflowData, createdBy: string): Promise<ApprovalWorkflow> {
    try {
      const stages: ApprovalStage[] = data.stages.map((stage, index) => ({
        id: `stage-${index}`,
        name: stage.name,
        approvers: stage.approvers,
        requiredApprovals: stage.requiredApprovals,
        approvals: [],
        status: index === 0 ? 'pending' : 'pending',
        order: stage.order,
      }))

      const query = `
        INSERT INTO approval_workflows (
          content_id, status, stages, current_stage, created_by
        ) VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `

      const values = [
        data.contentId,
        'pending',
        JSON.stringify(stages),
        0,
        createdBy,
      ]

      const result = await database.queryOne<any>(query, values)
      const workflow = this.mapToApprovalWorkflow(result)

      // Notify approvers of the first stage
      await this.notifyStageApprovers(workflow.id, 0)

      logger.info('Approval workflow created', {
        workflowId: workflow.id,
        contentId: data.contentId,
        stagesCount: stages.length,
      })

      return workflow
    } catch (error) {
      logger.error('Error creating approval workflow:', error)
      throw error
    }
  }

  async getWorkflow(id: string): Promise<ApprovalWorkflow | null> {
    try {
      const query = `SELECT * FROM approval_workflows WHERE id = $1`
      const result = await database.queryOne<any>(query, [id])
      return result ? this.mapToApprovalWorkflow(result) : null
    } catch (error) {
      logger.error('Error getting approval workflow:', error)
      throw error
    }
  }

  async getWorkflowByContentId(contentId: string): Promise<ApprovalWorkflow | null> {
    try {
      const query = `
        SELECT * FROM approval_workflows
        WHERE content_id = $1
        ORDER BY created_at DESC
        LIMIT 1
      `
      const result = await database.queryOne<any>(query, [contentId])
      return result ? this.mapToApprovalWorkflow(result) : null
    } catch (error) {
      logger.error('Error getting approval workflow by content ID:', error)
      throw error
    }
  }

  async submitApproval(
    workflowId: string,
    approverId: string,
    data: UpdateApprovalData
  ): Promise<ApprovalWorkflow | null> {
    try {
      const workflow = await this.getWorkflow(workflowId)
      if (!workflow) {
        throw new Error('Workflow not found')
      }

      if (workflow.status !== 'pending') {
        throw new Error('Workflow is not in pending status')
      }

      const currentStage = workflow.stages[workflow.currentStage]
      if (!currentStage) {
        throw new Error('Invalid workflow stage')
      }

      // Check if approver is authorized for this stage
      if (!currentStage.approvers.includes(approverId)) {
        throw new Error('User not authorized to approve this stage')
      }

      // Check if approver has already approved
      const existingApproval = currentStage.approvals.find(a => a.approverId === approverId)
      if (existingApproval) {
        throw new Error('User has already provided approval for this stage')
      }

      // Add approval
      const approval: Approval = {
        id: `approval-${Date.now()}`,
        approverId,
        status: data.status,
        comments: data.comments,
        timestamp: new Date(),
      }

      currentStage.approvals.push(approval)

      // Check if stage is complete
      if (data.status === 'rejected') {
        // Rejection completes the workflow
        workflow.status = 'rejected'
      } else if (data.status === 'revision_requested') {
        // Revision request completes the workflow
        workflow.status = 'revision_requested'
      } else if (data.status === 'approved') {
        const approvedCount = currentStage.approvals.filter(a => a.status === 'approved').length

        if (approvedCount >= currentStage.requiredApprovals) {
          currentStage.status = 'approved'

          // Move to next stage or complete workflow
          if (workflow.currentStage < workflow.stages.length - 1) {
            workflow.currentStage++
            await this.notifyStageApprovers(workflowId, workflow.currentStage)
          } else {
            workflow.status = 'approved'
          }
        }
      }

      // Update workflow in database
      const updateQuery = `
        UPDATE approval_workflows
        SET status = $1, stages = $2, current_stage = $3, updated_at = NOW()
        WHERE id = $4
        RETURNING *
      `

      const updateValues = [
        workflow.status,
        JSON.stringify(workflow.stages),
        workflow.currentStage,
        workflowId,
      ]

      const result = await database.queryOne<any>(updateQuery, updateValues)
      const updatedWorkflow = result ? this.mapToApprovalWorkflow(result) : null

      logger.info('Approval submitted', {
        workflowId,
        approverId,
        status: data.status,
        workflowStatus: workflow.status,
        currentStage: workflow.currentStage,
      })

      return updatedWorkflow
    } catch (error) {
      logger.error('Error submitting approval:', error)
      throw error
    }
  }

  async getPendingApprovals(approverId: string): Promise<ApprovalWorkflow[]> {
    try {
      const query = `
        SELECT * FROM approval_workflows
        WHERE status = 'pending'
        ORDER BY created_at ASC
      `
      const results = await database.query<any>(query)

      // Filter workflows where the user is an approver for the current stage
      const workflows = results
        .map(result => this.mapToApprovalWorkflow(result))
        .filter(workflow => {
          const currentStage = workflow.stages[workflow.currentStage]
          return currentStage &&
                 currentStage.approvers.includes(approverId) &&
                 !currentStage.approvals.some(a => a.approverId === approverId)
        })

      return workflows
    } catch (error) {
      logger.error('Error getting pending approvals:', error)
      throw error
    }
  }

  async getWorkflowHistory(contentId: string): Promise<ApprovalWorkflow[]> {
    try {
      const query = `
        SELECT * FROM approval_workflows
        WHERE content_id = $1
        ORDER BY created_at DESC
      `
      const results = await database.query<any>(query, [contentId])
      return results.map(result => this.mapToApprovalWorkflow(result))
    } catch (error) {
      logger.error('Error getting workflow history:', error)
      throw error
    }
  }

  async cancelWorkflow(workflowId: string, reason?: string): Promise<boolean> {
    try {
      const query = `
        UPDATE approval_workflows
        SET status = 'cancelled', updated_at = NOW()
        WHERE id = $1 AND status = 'pending'
      `
      const result = await database.query(query, [workflowId])

      if (result.length > 0) {
        logger.info('Approval workflow cancelled', { workflowId, reason })
        return true
      }

      return false
    } catch (error) {
      logger.error('Error cancelling approval workflow:', error)
      throw error
    }
  }

  async getWorkflowStats(): Promise<{
    total: number
    byStatus: Record<string, number>
    averageApprovalTime: number
  }> {
    try {
      const query = `
        SELECT
          status,
          COUNT(*) as count,
          AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) as avg_duration
        FROM approval_workflows
        WHERE created_at >= NOW() - INTERVAL '30 days'
        GROUP BY status
      `
      const results = await database.query<{
        status: string
        count: string
        avg_duration: string
      }>(query)

      const stats = {
        total: 0,
        byStatus: {} as Record<string, number>,
        averageApprovalTime: 0,
      }

      let totalDuration = 0
      let completedCount = 0

      results.forEach(result => {
        const count = parseInt(result.count, 10)
        stats.total += count
        stats.byStatus[result.status] = count

        if (result.status === 'approved' && result.avg_duration) {
          totalDuration += parseFloat(result.avg_duration) * count
          completedCount += count
        }
      })

      stats.averageApprovalTime = completedCount > 0 ? totalDuration / completedCount : 0

      return stats
    } catch (error) {
      logger.error('Error getting workflow stats:', error)
      throw error
    }
  }

  private async getDefaultApprovalStages(): Promise<{
    name: string
    approvers: string[]
    requiredApprovals: number
    order: number
  }[]> {
    // In a real implementation, this would be configurable
    return [
      {
        name: 'Content Review',
        approvers: ['content-manager-1', 'content-manager-2'],
        requiredApprovals: 1,
        order: 0,
      },
      {
        name: 'Final Approval',
        approvers: ['editor-in-chief'],
        requiredApprovals: 1,
        order: 1,
      },
    ]
  }

  private async notifyStageApprovers(workflowId: string, stageIndex: number): Promise<void> {
    try {
      // In a real implementation, this would send notifications
      // via email, Slack, or other channels
      logger.info('Notifying stage approvers', { workflowId, stageIndex })
    } catch (error) {
      logger.error('Error notifying stage approvers:', error)
    }
  }

  private mapToApprovalWorkflow(row: any): ApprovalWorkflow {
    return {
      id: row.id,
      contentId: row.content_id,
      status: row.status,
      stages: row.stages || [],
      currentStage: row.current_stage,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }
  }
}
