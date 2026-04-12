import { useState, useEffect } from 'react';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Checkbox } from './components/ui/checkbox';
import { db, Todo } from './db';

function App() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [newTodo, setNewTodo] = useState('');

  useEffect(() => {
    loadTodos();
  }, []);

  const loadTodos = async () => {
    const allTodos = await db.todos.toArray();
    setTodos(allTodos);
  };

  const addTodo = async () => {
    if (newTodo.trim()) {
      await db.todos.add({ text: newTodo, completed: false });
      setNewTodo('');
      loadTodos();
    }
  };

  const toggleTodo = async (id: number) => {
    await db.todos
      .where('id')
      .equals(id)
      .modify((todo) => {
        todo.completed = !todo.completed;
      });
    loadTodos();
  };

  const deleteTodo = async (id: number) => {
    await db.todos.delete(id);
    loadTodos();
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-md mx-auto bg-white rounded-lg shadow p-6">
        <h1 className="text-2xl font-bold mb-4">Todo App</h1>
        <div className="flex gap-2 mb-4">
          <Input
            value={newTodo}
            onChange={(e) => setNewTodo(e.target.value)}
            placeholder="Add a new todo"
            onKeyPress={(e) => e.key === 'Enter' && addTodo()}
          />
          <Button onClick={addTodo}>Add</Button>
        </div>
        <ul className="space-y-2">
          {todos.map((todo) => (
            <li key={todo.id} className="flex items-center gap-2">
              <Checkbox checked={todo.completed} onCheckedChange={() => toggleTodo(todo.id!)} />
              <span className={todo.completed ? 'line-through text-gray-500' : ''}>
                {todo.text}
              </span>
              <Button variant="destructive" size="sm" onClick={() => deleteTodo(todo.id!)}>
                Delete
              </Button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default App;
