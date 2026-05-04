import fs from 'fs';
import path from 'path';
import { prisma } from './db.js';

const LOG_FILE = path.join(process.cwd(), 'server_debug.log');

/**
 * Standardized logger for the WhatsApp Broadcast Platform.
 * Captures logs to console, file, and database audit logs where applicable.
 */
class Logger {
  constructor() {
    this.stream = fs.createWriteStream(LOG_FILE, { flags: 'a' });
  }

  _format(level, message, context = {}) {
    const timestamp = new Date().toISOString();
    const correlationId = context.correlationId || 'N/A';
    const ctxString = Object.keys(context).length > 0 ? ` | Context: ${JSON.stringify(context)}` : '';
    return `[${timestamp}] [${level}] [Corr: ${correlationId}] ${message}${ctxString}`;
  }

  _write(level, message, context) {
    const logLine = this._format(level, message, context);
    console.log(logLine);
    this.stream.write(logLine + '\n');
  }

  info(message, context) {
    this._write('INFO', message, context);
  }

  debug(message, context) {
    if (process.env.NODE_ENV === 'development') {
      this._write('DEBUG', message, context);
    }
  }

  warn(message, context) {
    this._write('WARN', message, context);
  }

  error(message, context = {}, error) {
    const errorDetails = error ? ` | Stack: ${error.stack}` : '';
    const logLine = this._format('ERROR', message, context) + errorDetails;
    console.error(logLine);
    this.stream.write(logLine + '\n');

    // Persist critical errors to AuditLog
    if (context.persist !== false) {
      this.audit('SYSTEM_ERROR', 'System', null, { 
        message, 
        error: error?.message, 
        ...context 
      }).catch(err => console.error('Failed to persist audit log:', err));
    }
  }

  /**
   * Logs a high-level action to the AuditLog table.
   */
  async audit(action, entity, entityId, metadata = {}) {
    try {
      await prisma.auditLog.create({
        data: {
          action,
          entity,
          entityId,
          metadata: metadata || {},
        },
      });
    } catch (err) {
      console.error('CRITICAL: Audit logging failed:', err.message);
    }
  }
}

export const logger = new Logger();
