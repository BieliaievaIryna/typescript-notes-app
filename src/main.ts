function SanitizeInput() {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = function (...args: any[]) {
      const data = args[0];

      if (data.noteTitle) {
        data.noteTitle = data.noteTitle.trim();
      }

      if (data.noteContent) {
        data.noteContent = data.noteContent.trim();
      }

      return originalMethod.apply(this, args);
    };
  };
}

function ValidateNotEmpty() {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = function (...args: any[]) {
      const data = args[0];

      if (!data.noteTitle || !data.noteContent) {
        throw new Error('Note title and content cannot be empty');
      }

      return originalMethod.apply(this, args);
    };
  };
}

function AutoUpdateTimestamp() {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = function (...args: any[]) {
      const note = originalMethod.apply(this, args);

      if (note) {
        note.updatedAt = new Date().toISOString();
      }

      return note;
    };
  };
}

const mockServerResponse: NoteServerDTO[] = [
  {
    note_id: '1',
    note_title: 'Прочитати: Великий Гетсбі (Ф. Скотт Фіцджеральд)',
    note_content: 'Проаналізувати мотив «зеленого вогника» та крах американської мрії.',
    created_at: '2026-02-01T10:00:00Z',
    updated_at: '2026-02-02T15:30:00Z',
    is_completed: true,
    type: 'default',
  },
  {
    note_id: '2',
    note_title: 'Купити: На Західному фронті без змін (Е.М. Ремарк)',
    note_content: 'Звернути увагу на контраст між мирним життям та жахами окопів.',
    created_at: '2026-02-05T09:15:00Z',
    updated_at: '2026-02-05T09:15:00Z',
    is_completed: false,
    type: 'confirmation',
  },
  {
    note_id: '3',
    note_title: 'Написати есе: Фієста (Е. Хемінґвей)',
    note_content: 'Розібрати «принцип айсберга» Хемінґвея.',
    created_at: '2026-02-10T14:20:00Z',
    updated_at: '2026-02-12T11:00:00Z',
    is_completed: false,
    type: 'default',
  },
];

interface Note {
  noteId: string;
  noteTitle: string;
  noteContent: string;
  createdAt: string;
  updatedAt: string;
  isCompleted: boolean;
  type: 'default' | 'confirmation';
}

type StartsWithUppercase<StringPart extends string> =
  StringPart extends Uncapitalize<StringPart> ? false : true;

type CamelToSnake<Text extends string> =
  Text extends `${infer CurrentChar}${infer RestOfString}`
  ? StartsWithUppercase<RestOfString> extends true
  ? `${Uncapitalize<CurrentChar>}_${CamelToSnake<RestOfString>}`
  : `${Uncapitalize<CurrentChar>}${CamelToSnake<RestOfString>}`
  : Text;

type MapToSnakeCaseDTO<T> = {
  [K in keyof T as CamelToSnake<K & string>]: T[K];
};

type SnakeToCamel<Text extends string> =
  Text extends `${infer CurrentChar}_${infer RestOfString}`
  ? `${CurrentChar}${Capitalize<SnakeToCamel<RestOfString>>}`
  : Text;

type MapToCamelCaseDomain<T> = {
  [K in keyof T as SnakeToCamel<K & string>]: T[K];
};

type NoteServerDTO = MapToSnakeCaseDTO<Note>;
type ReconstructedNote = MapToCamelCaseDomain<NoteServerDTO>;

function mapToDTO(data: ReconstructedNote): NoteServerDTO {
  return {
    note_id: data.noteId,
    note_title: data.noteTitle,
    note_content: data.noteContent,
    created_at: data.createdAt,
    updated_at: data.updatedAt,
    is_completed: data.isCompleted,
    type: data.type,
  };
}

function mapFromDTO(data: NoteServerDTO): ReconstructedNote {
  return {
    noteId: data.note_id,
    noteTitle: data.note_title,
    noteContent: data.note_content,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    isCompleted: data.is_completed,
    type: data.type,
  };
}

class BaseNote implements Note {
  constructor(
    public noteId: string,
    public noteTitle: string,
    public noteContent: string,
    public createdAt: string,
    public updatedAt: string,
    public isCompleted: boolean,
    public type: 'default' | 'confirmation'
  ) { }

  markCompleted() {
    this.isCompleted = true;
  }
}

class DefaultNote extends BaseNote { }

class ConfirmationNote extends BaseNote {
  confirmAction(action: 'edit' | 'delete') {
    console.log(`Confirmation required to ${action} this note`);

    return true;
  }
}

class NotesList {
  private notes: BaseNote[] = [];

  constructor(serverData: NoteServerDTO[]) {
    this.notes = serverData.map((dto) => {
      const data = mapFromDTO(dto);

      if (data.type === 'confirmation') {
        return new ConfirmationNote(
          data.noteId,
          data.noteTitle,
          data.noteContent,
          data.createdAt,
          data.updatedAt,
          data.isCompleted,
          data.type
        );
      }

      return new DefaultNote(
        data.noteId,
        data.noteTitle,
        data.noteContent,
        data.createdAt,
        data.updatedAt,
        data.isCompleted,
        data.type
      );
    });
  }

  @ValidateNotEmpty()
  @SanitizeInput()
  addNote(note: Omit<Note, 'createdAt' | 'updatedAt'>) {
    let newNote: BaseNote;

    if (note.type === 'confirmation') {
      newNote = new ConfirmationNote(
        note.noteId,
        note.noteTitle,
        note.noteContent,
        new Date().toISOString(),
        new Date().toISOString(),
        false,
        note.type
      );
    } else {
      newNote = new DefaultNote(
        note.noteId,
        note.noteTitle,
        note.noteContent,
        new Date().toISOString(),
        new Date().toISOString(),
        false,
        note.type
      );
    }

    this.notes.push(newNote);
  }

  deleteNote(id: string) {
    const note = this.getNote(id);

    if (!note) return;

    if (note instanceof ConfirmationNote) {
      if (!note.confirmAction('delete')) {
        return;
      }
    }

    this.notes = this.notes.filter((n) => n.noteId !== id);
  }

  getNote(id: string) {
    return this.notes.find((note) => note.noteId === id);
  }

  @ValidateNotEmpty()
  @SanitizeInput()
  @AutoUpdateTimestamp()
  editNote(id: string, data: Partial<Note>) {
    const note = this.getNote(id);

    if (!note) {
      throw new Error('Note not found');
    }

    if (note instanceof ConfirmationNote) {
      if (!note.confirmAction('edit')) {
        return;
      }
    }

    Object.assign(note, data);

    return note;
  }

  markCompleted(id: string) {
    const note = this.getNote(id);

    if (note) {
      note.markCompleted();
    }
  }

  getStats() {
    const total = this.notes.length;
    const remaining = this.notes.filter((n) => !n.isCompleted).length;

    return { total, remaining };
  }

  search(query: string) {
    const q = query.toLowerCase();

    return this.notes.filter(
      (n) =>
        n.noteTitle.toLowerCase().includes(q) ||
        n.noteContent.toLowerCase().includes(q)
    );
  }

  sortByStatus() {
    return [...this.notes].sort(
      (a, b) => Number(a.isCompleted) - Number(b.isCompleted)
    );
  }

  sortByCreatedAt() {
    return [...this.notes].sort(
      (a, b) =>
        new Date(a.createdAt).getTime() -
        new Date(b.createdAt).getTime()
    );
  }
}
