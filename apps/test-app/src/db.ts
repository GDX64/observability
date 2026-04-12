import Dexie, { Table } from 'dexie';

export interface Todo {
  id?: number;
  text: string;
  completed: boolean;
}

export class MySubClassedDexie extends Dexie {
  todos!: Table<Todo>;

  constructor() {
    super('myDatabase');
    this.version(1).stores({
      todos: '++id, text, completed'
    });
  }
}

export const db = new MySubClassedDexie();
