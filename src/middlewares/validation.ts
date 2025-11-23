import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { ValidationError } from '../utils/errors';

export const validate = (schema: Joi.ObjectSchema) => {
    return (req: Request, res: Response, next: NextFunction): void => {
        const { error, value } = schema.validate(req.body, {
            abortEarly: false,
            stripUnknown: true
        });

        if (error) {
            const errorMessage = error.details
                .map(detail => detail.message)
                .join(', ');
            next(new ValidationError(errorMessage));
            return;
        }


        req.body = value;
        next();
    };
};

export const schemas = {
    register: Joi.object({
        email: Joi.string().email().required(),
        password: Joi.string().min(8).required(),
        role: Joi.string().valid('admin', 'manager', 'agent').required(),
        phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).optional()
    }),

    login: Joi.object({
        email: Joi.string().email().required(),
        password: Joi.string().required()
    }),

    refreshToken: Joi.object({
        refreshToken: Joi.string().required()
    }),

    // Lead schemas
    createLead: Joi.object({
        name: Joi.string().min(2).max(255).required(),
        phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).required(),
        email: Joi.string().email().optional().allow(''),
        status: Joi.string().valid('new', 'contacted', 'qualified', 'converted').optional(),
        source: Joi.string().max(100).optional(),
        assigned_to: Joi.number().integer().positive().optional(),
        image_url: Joi.string().uri().optional()
    }),

    updateLead: Joi.object({
        name: Joi.string().min(2).max(255).optional(),
        phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).optional(),
        email: Joi.string().email().optional().allow(''),
        status: Joi.string().valid('new', 'contacted', 'qualified', 'converted').optional(),
        source: Joi.string().max(100).optional(),
        assigned_to: Joi.number().integer().positive().optional().allow(null),
        image_url: Joi.string().uri().optional().allow(null)
    }),

    assignLead: Joi.object({
        agent_id: Joi.number().integer().positive().required()
    }),

    // Call task schemas
    createCallTask: Joi.object({
        lead_id: Joi.number().integer().positive().required(),
        agent_id: Joi.number().integer().positive().required(),
        scheduled_at: Joi.date().optional(),
        idempotency_key: Joi.string().optional()
    }),

    completeCallTask: Joi.object({
        notes: Joi.string().min(1).max(1000).required(),
        outcome: Joi.string().min(1).max(255).required()
    }),

    // Image upload schema
    imageUploadUrl: Joi.object({
        fileName: Joi.string().required(),
        fileType: Joi.string().valid('image/jpeg', 'image/png', 'image/jpg', 'image/webp').required()
    })
};