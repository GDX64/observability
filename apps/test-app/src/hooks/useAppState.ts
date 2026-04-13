import { useState, useEffect } from 'react';
import { db, Todo } from '../db';
import { logger } from '@glmachado/logger';

export function useAppState() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [newTodo, setNewTodo] = useState('');

  useEffect(() => {
    loadTodos();
  }, []);

  const loadTodos = async () => {
    using _span = logger.span('load-todos');
    logger.info('Loading todos');
    try {
      const allTodos = await db.todos.toArray();
      setTodos(allTodos);
      logger.info('Todos loaded successfully');
    } catch (error) {
      logger.error(`Failed to load todos: ${error}`);
    }
  };

  const addTodo = async () => {
    if (newTodo.trim()) {
      using _span = logger.span('add-todo');
      logger.info('Adding new todo');
      try {
        await db.todos.add({ text: newTodo, completed: false });
        setNewTodo('');
        loadTodos();
        logger.info('Todo added successfully');
      } catch (error) {
        logger.error(`Failed to add todo: ${error}`);
      }
    }
  };

  const toggleTodo = async (id: number) => {
    using _span = logger.span('toggle-todo');
    logger.info('Toggling todo');
    try {
      await db.todos
        .where('id')
        .equals(id)
        .modify((todo) => {
          todo.completed = !todo.completed;
        });
      loadTodos();
      logger.info('Todo toggled successfully');
    } catch (error) {
      logger.error(`Failed to toggle todo: ${error}`);
    }
  };

  const deleteTodo = async (id: number) => {
    using _span = logger.span('delete-todo');
    logger.info('Deleting todo');
    try {
      await db.todos.delete(id);
      loadTodos();
      logger.info('Todo deleted successfully');
    } catch (error) {
      logger.error(`Failed to delete todo: ${error}`);
    }
  };

  return {
    todos,
    newTodo,
    setNewTodo,
    addTodo,
    toggleTodo,
    deleteTodo
  };
}
