import {
  Catch,
  ArgumentsHost,
  HttpException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { Request, Response } from 'express';
import { TypeORMError } from 'typeorm';

type ResponseObjType = {
  responseCode: number;
  timestamp: string;
  path: string;
  responseMessage: string | object;
};

@Catch()
export class AllExceptionsFilter extends BaseExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const myResObj: ResponseObjType = {
      responseCode: 500,
      timestamp: new Date().toISOString(),
      path: request.url,
      responseMessage: 'Internal Server Error',
    };

    const hostWithContext = host as {
      getClass?: () => { name?: string };
      getHandler?: () => { name?: string };
    };
    const controllerName = hostWithContext.getClass?.()?.name;
    const handlerName = hostWithContext.getHandler?.()?.name;
    const contextName =
      controllerName && handlerName
        ? `${controllerName}.${handlerName}`
        : AllExceptionsFilter.name;

    const stack = exception instanceof Error ? exception.stack : undefined;

    if (exception instanceof UnauthorizedException) {
      myResObj.responseCode = exception.getStatus();
      myResObj.responseMessage = 'Unauthorized: invalid credentials';
      this.logger.warn(
        `Unauthorized [${request.method} ${request.url}]: ${JSON.stringify(exception.getResponse())}`,
        contextName,
      );
    } else if (exception instanceof HttpException) {
      myResObj.responseCode = exception.getStatus();
      myResObj.responseMessage = exception.getResponse();
      this.logger.warn(
        `HttpException [${request.method} ${request.url}]: ${JSON.stringify(exception.getResponse())}`,
        contextName,
      );
    } else if (exception instanceof TypeORMError) {
      myResObj.responseCode = 422;
      myResObj.responseMessage =
        'operation failed due to invalid data. Please contact Support';
      this.logger.error(
        `TypeORMError [${request.method} ${request.url}]: ${exception.message}`,
        stack,
        contextName,
      );
    } else {
      myResObj.responseCode = 500;
      myResObj.responseMessage =
        'An Unexpected Error Occurred. Please contact System Admin';
      this.logger.error(
        `ServerError [${request.method} ${request.url}]: ${(exception as Error)?.message || JSON.stringify(exception)}`,
        stack,
        contextName,
      );
    }
    response.status(myResObj.responseCode).json(myResObj);
  }
}
