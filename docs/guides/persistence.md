# How to persist atoms

The core itself doesn't support persistence.
There are several patterns for persistence depending on requirements.

## A simple pattern with localStorage

```js
const strAtom = atom(localStorage.getItem('myKey') ?? 'foo')

const strAtomWithPersistence = atom(
  (get) => get(strAtom),
  (get, set, newStr) => {
    set(strAtom, newStr)
    localStorage.setItem('myKey', newStr)
  }
)
```

## A helper function with localStorage and JSON parse

```js
const atomWithLocalStorage = (key, initialValue) => {
  const getInitialValue = () => {
    const item = localStorage.getItem(key)
    if (item !== null) {
      return JSON.parse(item)
    }
    return initialValue
  }
  const baseAtom = atom(getInitialValue())
  const derivedAtom = atom(
    (get) => get(baseAtom),
    (get, set, update) => {
      const nextValue =
        typeof update === 'function' ? update(get(baseAtom)) : update
      set(baseAtom, nextValue)
      localStorage.setItem(key, JSON.stringify(nextValue))
    }
  )
  return derivedAtom
}
```

(Error handling should be added.)

## A helper function with AsyncStorage and JSON parse

This requires [onMount](../api/core.js#onmount).

```js
const atomWithAsyncStorage = (key, initialValue) => {
  const baseAtom = atom(initialValue)
  baseAtom.onMount = (setValue) => {
    ;(async () => {
      const item = await AsyncStorage.getItem(key)
      setValue(JSON.parse(item))
    })()
  }
  const derivedAtom = atom(
    (get) => get(baseAtom),
    (get, set, update) => {
      const nextValue =
        typeof update === 'function' ? update(get(baseAtom)) : update
      set(baseAtom, nextValue)
      AsyncStorage.setItem(key, JSON.stringify(nextValue))
    }
  )
  return derivedAtom
}
```

---

## A serialize atom pattern

```tsx
const serializeAtom = atom<
  null,
  | { type: 'serialize'; callback: (value: string) => void }
  | { type: 'deserialize'; value: string }
>(null, (get, set, action) => {
  if (action.type === 'serialize') {
    const obj = {
      todos: get(todosAtom).map(get),
    }
    action.callback(JSON.stringify(obj))
  } else if (action.type === 'deserialize') {
    const obj = JSON.parse(action.value)
    // needs error handling and type checking
    set(
      todosAtom,
      obj.todos.map((todo: Todo) => atom(todo))
    )
  }
})

const Persist: React.FC = () => {
  const [, dispatch] = useAtom(serializeAtom)
  const save = () => {
    dispatch({
      type: 'serialize',
      callback: (value) => {
        localStorage.setItem('serializedTodos', value)
      },
    })
  }
  const load = () => {
    const value = localStorage.getItem('serializedTodos')
    if (value) {
      dispatch({ type: 'deserialize', value })
    }
  }
  return (
    <div>
      <button onClick={save}>Save to localStorage</button>
      <button onClick={load}>Load from localStorage</button>
    </div>
  )
}
```

### Examples

https://codesandbox.io/s/jotai-todos-ijyxm

## A pattern with atomFamily

```tsx
const serializeAtom = atom<
  null,
  | { type: 'serialize'; callback: (value: string) => void }
  | { type: 'deserialize'; value: string }
>(null, (get, set, action) => {
  if (action.type === 'serialize') {
    const todos = get(todosAtom)
    const todoMap: Record<string, { title: string; completed: boolean }> = {}
    todos.forEach((id) => {
      todoMap[id] = get(todoAtomFamily({ id }))
    })
    const obj = {
      todos,
      todoMap,
      filter: get(filterAtom),
    }
    action.callback(JSON.stringify(obj))
  } else if (action.type === 'deserialize') {
    const obj = JSON.parse(action.value)
    // needs error handling and type checking
    set(filterAtom, obj.filter)
    obj.todos.forEach((id: string) => {
      const todo = obj.todoMap[id]
      set(todoAtomFamily({ id, ...todo }), todo)
    })
    set(todosAtom, obj.todos)
  }
})

const Persist: React.FC = () => {
  const [, dispatch] = useAtom(serializeAtom)
  const save = () => {
    dispatch({
      type: 'serialize',
      callback: (value) => {
        localStorage.setItem('serializedTodos', value)
      },
    })
  }
  const load = () => {
    const value = localStorage.getItem('serializedTodos')
    if (value) {
      dispatch({ type: 'deserialize', value })
    }
  }
  return (
    <div>
      <button onClick={save}>Save to localStorage</button>
      <button onClick={load}>Load from localStorage</button>
    </div>
  )
}
```

### Examples

https://codesandbox.io/s/react-typescript-forked-eilkg
