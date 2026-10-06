import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

@Injectable()
export class CatalogSlugPipe implements PipeTransform<string, string> {
  transform(value: string) {
    const slug = typeof value === 'string' ? value.trim() : '';
    if (slug.length > 80 || !SLUG.test(slug)) {
      throw new BadRequestException('Invalid slug');
    }
    return slug;
  }
}
