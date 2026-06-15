import { BaseJob, type JobContext } from '../core/BaseJob.js';

export class {{Name}}Job extends BaseJob {
  public readonly name = '{{name}}';
  public readonly schedule = '{{schedule}}';
  public readonly description = '{{description}}';

  protected async handle(context: JobContext): Promise<void> {
    context.logger.info({ event: 'job.{{name}}.start' }, 'Starting {{name}}');

    // TODO: implement {{description}}

    context.logger.info({ event: 'job.{{name}}.done' }, '{{name}} completed');
  }
}
