/**
 * Clock API Route Handlers
 * Handles clock-in, clock-out, and status endpoints for students
 */

import type { Request, Response } from 'express'
import { ClockService } from '@/lib/clock-service'
import { ClockError } from '@/lib/enhanced-error-handling'

const clockService = new ClockService()

export async function clockInHandler(req: Request, res: Response) {
  try {
    const { studentId, siteId, location } = req.body

    if (!studentId || !siteId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: studentId and siteId'
      })
    }

    const result = await clockService.clockIn({
      studentId,
      siteId,
      location,
      timestamp: new Date()
    })

    if (result.success) {
      res.json({
        success: true,
        data: result.data
      })
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      })
    }
  } catch (error) {
    console.error('Clock-in error:', error)
    
    if (error instanceof ClockError) {
      res.status(error.statusCode || 500).json({
        success: false,
        error: error.message,
        code: error.code
      })
    } else {
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      })
    }
  }
}

export async function clockOutHandler(req: Request, res: Response) {
  try {
    const { studentId, location } = req.body

    if (!studentId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: studentId'
      })
    }

    const result = await clockService.clockOut({
      studentId,
      location,
      timestamp: new Date()
    })

    if (result.success) {
      res.json({
        success: true,
        data: result.data
      })
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      })
    }
  } catch (error) {
    console.error('Clock-out error:', error)
    
    if (error instanceof ClockError) {
      res.status(error.statusCode || 500).json({
        success: false,
        error: error.message,
        code: error.code
      })
    } else {
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      })
    }
  }
}

export async function clockStatusHandler(req: Request, res: Response) {
  try {
    const { studentId } = req.params

    if (!studentId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameter: studentId'
      })
    }

    const result = await clockService.getClockStatus(studentId)

    if (result.success) {
      res.json({
        success: true,
        data: result.data
      })
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      })
    }
  } catch (error) {
    console.error('Clock status error:', error)
    
    if (error instanceof ClockError) {
      res.status(error.statusCode || 500).json({
        success: false,
        error: error.message,
        code: error.code
      })
    } else {
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      })
    }
  }
}