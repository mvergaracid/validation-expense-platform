import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, signal } from '@angular/core';

@Component({
  selector: 'app-file-dropzone',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './file-dropzone.component.html'
})
export class FileDropzoneComponent {
  @Input() accept = '.csv';
  @Input() disabled = false;
  @Output() fileSelected = new EventEmitter<File>();

  protected readonly isDragging = signal(false);

  onDragOver(evt: DragEvent): void {
    if (this.disabled) return;
    evt.preventDefault();
    this.isDragging.set(true);
  }

  onDragLeave(evt: DragEvent): void {
    if (this.disabled) return;
    evt.preventDefault();
    this.isDragging.set(false);
  }

  onDrop(evt: DragEvent): void {
    if (this.disabled) return;
    evt.preventDefault();
    this.isDragging.set(false);

    const file = evt.dataTransfer?.files?.[0];
    if (file) this.fileSelected.emit(file);
  }

  onFileInput(evt: Event): void {
    if (this.disabled) return;

    const input = evt.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) this.fileSelected.emit(file);

    input.value = '';
  }
}
