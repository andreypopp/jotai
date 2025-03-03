This doc describes core `jotai` bundle.

## atom

`atom` is a function to create an atom config. The atom config is an immutable object. The atom config itself doesn't hold an atom value. The atom value is stored in a Provider state.

```tsx
// primitive atom
function atom<Value>(initialValue: Value): PrimitiveAtom<Value>

// read-only atom
function atom<Value>(read: (get: Getter) => Value | Promise<Value>): Atom<Value>

// writable derived atom
function atom<Value, Update>(
  read: (get: Getter) => Value | Promise<Value>,
  write: (get: Getter, set: Setter, update: Update) => void | Promise<void>
): WritableAtom<Value, Update>

// write-only derived atom
function atom<Value, Update>(
  read: Value,
  write: (get: Getter, set: Setter, update: Update) => void | Promise<void>
): WritableAtom<Value, Update>
```

- `initialValue`: as the name says, it's an initial value which is the atom's going to return unless its value doesn't get changed.
- `read`: a function that's going to get called on every re-render. The signature of `read` is `(get) => Value | Promise<Value>`, and `get` is a function that takes an atom config and returns its value stored in Provider described below. Dependency is tracked, so if `get` is used for an atom at least once, the `read` will be reevaluated whenever the atom value is changed.
- `write`: a function mostly used for mutating atom's values, for a better description; it gets called whenever we call the second value of the returned pair of `useAtom`, the `useAtom()[1]`. The default value of this function in the primitive atom will change the value of that atom. The signature of `write` is `(get, set, update) => void | Promise<void>`. `get` is similar to the one described above, but it doesn't track the dependency. `set` is a function that takes an atom config and a new value which then updates the atom value in Provider. `update` is an arbitrary value that we receive from the updating function returned by `useAtom` described below.

```tsx
const primitiveAtom = atom(initialValue)
const derivedAtomWithRead = atom(read)
const derivedAtomWithReadWrite = atom(read, write)
const derivedAtomWithWriteOnly = atom(null, write)
```

There are two kinds of atoms: a writable atom and a read-only atom. Primitive atoms are always writable. Derived atoms are writable if the `write` is specified. The `write` of primitive atoms is equivalent to the `setState` of `React.useState`.

### debugLabel

The created atom config can have an optional property `debugLabel`. The debug label will be used to display the atom in debugging. See [Debugging guide](../guides/debugging.md) for more information.

Note: Technically, the debug labels don’t have to be unique. However, it’s generally recommended to make them distinguishable.

### onMount

The created atom config can have an optional property `onMount`. `onMount` is a function which takes a function `setAtom` and returns `onUnmount` function optionally.

The `onMount` function will be invoked when the atom is first used in a provider, and `onUnmount` will be invoked when it’s not used. In some edge cases, an atom can be unmounted and then mounted immediately.

```tsx
const anAtom = atom(1)
anAtom.onMount = (setAtom) => {
  console.log('atom is mounted in provider')
  setAtom(c => c + 1) // increment count on mount
  return () => { ... } // return optional onUnmount function
}
```

Invoking `setAtom` function will invoke the atom’s `write`. Customizing `write` allows changing the behavior.

```tsx
const countAtom = atom(1)
const derivedAtom = atom(
  (get) => get(countAtom),
  (get, set, action) => {
    if (action.type === 'init') {
      set(countAtom, 10)
    } else if (action.type === 'inc') {
      set(countAtom, (c) => c + 1)
    }
  }
)
derivedAtom.onMount = (setAtom) => {
  setAtom({ type: 'init' })
}
```

## Provider

```ts
const Provider: React.FC<{
  initialValues?: Iterable<readonly [AnyAtom, unknown]>
  scope?: Scope
}>
```

Atom configs don't hold values. Atom values reside in separate stores. A Provider is a component that contains a store and provides atom values under the component tree. A Provider works just like React context provider. If you don't use a Provider, it works as provider-less mode with a default store. A Provider will be necessary if we need to hold different atom values for different component trees. Provider also has some capabilities described below, which doesn't exist in the provider-less mode.

```jsx
const Root = () => (
  <Provider>
    <App />
  </Provider>
)
```

### `initialValues` prop

A Provider accepts an optional prop `initialValues` which you can specify
some initial atom values.
The use cases of this are testing and server side rendering.

#### Example

```jsx
const TestRoot = () => (
  <Provider initialValues=[[atom1, 1], [atom2, 'b']]>
    <Component />
  </Provider>
)
```

#### TypeScript

The `initialValues` prop is not type friendly.
We can mitigate it by using a helper function.

```ts
const createInitialValues = () => {
  const initialValues: (readonly [Atom<unknown>, unknonw])[] = []
  const get = () => initialValues
  const set = <Value>(anAtom: Atom<Value>, value: Value) => {
    initialValues.push([anAtom, value])
  }
  return { get, set }
}
```

### `scope` prop

A Provider accepts an optional prop `scope` which you can use for scoped atoms.
It works only for atoms with the same scope.
The recommendation for the scope value is a unique symbol.
The use case of scope is for library usage.

#### Example

```jsx
const myScope = Symbol()

const anAtom = atom('')
anAtom.scope = myScope

const LibraryRoot = () => (
  <Provider scope={myScope}>
    <Component />
  </Provider>
)
```

## useAtom

```ts
// primitive or writable derived atom
function useAtom<Value, Update>(
  atom: WritableAtom<Value, Update>
): [Value, SetAtom<Update>]

// read-only atom
function useAtom<Value>(atom: Atom<Value>): [Value, never]
```

The useAtom hook is to read an atom value stored in the Provider. It returns the atom value and an updating function as a tuple, just like useState. It takes an atom config created with `atom()`. Initially, there is no value stored in the Provider. The first time the atom is used via `useAtom`, it will add an initial value in the Provider. If the atom is a derived atom, the read function is executed to compute an initial value. When an atom is no longer used, meaning all the components using it is unmounted, and the atom config no longer exists, the value is removed from the Provider.

```js
const [value, updateValue] = useAtom(anAtom)
```

The `updateValue` takes just one argument, which will be passed to the third argument of writeFunction of the atom. The behavior totally depends on how the writeFunction is implemented.

---

## Notes

### How atom dependency works

To begin with, let's explain this. In the current implementation, every time we invoke the "read" function, we refresh the dependencies and dependents. For example, If A depends on B, it means that B has a dependency on A, and A is a dependent of B.

```js
const uppercaseAtom = atom((get) => get(textAtom).toUpperCase())
```

The read function is the first parameter of the atom.
The dependency will initially be empty. On first use, we run the read function and know that `uppercaseAtom` depends on `textAtom`. `textAtom` has a dependency on `uppercaseAtom`. So, add `uppercaseAtom` to the dependents of `textAtom`.
When we re-run the read function (because its dependency (=textAtom) is updated),
the dependency is built again, which is the same in this case. We then remove stale dependents and replace with the latest one.

### Atoms can be created on demand

Basic examples in readme only show defining atoms globally outside components.
There is no restrictions about when we create an atom.
As long as we know atoms are identified by their object referential identity,
it's okay to create them at anytime.

If you create atoms in render functions, you would typically want to use
a hook like `useRef` or `useMemo` for memoization. If not, the atom would be created everytime the component renders.

You can create an atom and store it wth `useState` or even in another atom.
See an example in [issue #5](https://github.com/pmndrs/jotai/issues/5).

You can cache atoms somewhere globally.
See [this example](https://twitter.com/dai_shi/status/1317653548314718208) or
[that example](https://github.com/pmndrs/jotai/issues/119#issuecomment-706046321).

Check [`atomFamily`](../api/utils.md#atomfamily) in utils for parameterized atoms.

### Some more notes about atoms

- If you create a primitive atom, it will use predefined read/write functions to emulate `useState` behavior.
- If you create an atom with read/write functions, they can provide any behavior with some restrictions as follows.
- `read` function will be invoked during React render phase, so the function has to be pure. What is pure in React is described [here](https://gist.github.com/sebmarkbage/75f0838967cd003cd7f9ab938eb1958f).
- `write` function will be invoked where you called initially and in useEffect for following invocations. So, you shouldn't call `write` in render.
- When an atom is initially used with `useAtom`, it will invoke `read` function to get the initial value, this is recursive process. If an atom value exists in Provider, it will be used instead of invoking `read` function.
- Once an atom is used (and stored in Provider), it's value is only updated if its dependencies are updated (including updating directly with useAtom).
