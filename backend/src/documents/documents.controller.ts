import {
  Controller,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DocumentsService } from './documents.service';
import { ProcessDocumentDto } from './dto/process-document.dto';

// Límite de 15 MB por archivo (control de costos/memoria en Cloud Run).
const MAX_FILE_SIZE = 15 * 1024 * 1024;

@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  /**
   * Procesa un PDF (syllabus o diapositivas) con Gemini multimodal.
   * multipart/form-data: campo "file" (PDF) + query ?tipo=syllabus|diapositivas
   */
  @Post('process')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_FILE_SIZE } }),
  )
  process(
    @UploadedFile() file: Express.Multer.File,
    @Query() query: ProcessDocumentDto,
  ) {
    return this.documentsService.process(file, query.tipo);
  }
}
