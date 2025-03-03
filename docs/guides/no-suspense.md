# No Suspense

> The content of this page would be easier if you have taken a look on the [introduction/async](../introduction/async.md) part of the docs.

Sometimes we need to wrap our components in suspense to use asynchronous atoms. Two kinds of atoms need Suspense.

- Derived async atoms (async `read` function)
- Asynchronous actions (async `write`)

But sometimes we're not allowed to wrap our components in Suspense, So we're going to do some hacks below and and make our async atoms synchronous.

## Async `read`

Check this derived async atom:

```tsx
const urlAtom = atom('https://json.host.com')
const fetchUrlAtom = atom(async (get) => {
  const response = await fetch(get(urlAtom))
  return await response.json()
})
```

It needs Suspense because the `read` function returns a promise(async function).

We shouldn't return a promise if we don't need it to suspend, so we have to change the structure slightly.

Here's the new code.

```tsx
const fetchResultAtom = atom({ loading: true, error: null, data: null })
const runFetchAtom = atom(
  (get) => get(fetchResultAtom),
  (_get, set, url) => {
    const fetchData = async () => {
      set(fetchResultAtom, (prev) => ({ ...prev, loading: true }))
      try {
        const response = await fetch(url)
        const data = await response.json()
        set(fetchResultAtom, { loading: false, error: null, data })
      } catch (error) {
        set(fetchResultAtom, { loading: false, error, data: null })
      }
    }
    fetchData()
  }
)
runFetchAtom.onMount = (runFetch) => {
  runFetch('https://json.host.com')
}

const Component = () => {
  const [result] = useAtom(runFetchAtom)

  console.log(result) // { loading: ..., error: ..., data: ... }
  return <div>...</div>
}
```

## Async `write`

The original code is:

```tsx
const fetchCountAtom = atom(
  (get) => get(countAtom),
  async (_get, set, url) => {
    const response = await fetch(url)
    set(countAtom, (await response.json()).count)
  }
)
```

The `write` function (2nd arg) returns a promise, which will suspend.

We just need to make it synchronous and returns nothing, just like this:

```tsx
const fetchCountAtom = atom(
  (get) => get(countAtom),
  (_get, set, url) => {
    const fetchData = async () => {
      const response = await fetch(url)
      set(countAtom, (await response.json()).count)
    }
    fetchData()
  }
)
```
