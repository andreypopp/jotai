import React, {
  Fragment,
  useState,
  useRef,
  useEffect,
  StrictMode,
  Suspense,
} from 'react'
import { fireEvent, render, waitFor } from '@testing-library/react'
import {
  Provider as ProviderOrig,
  atom,
  useAtom,
  WritableAtom,
} from '../../src/index'
import { atomFamily } from '../../src/utils'
import type { SetStateAction } from '../../src/core/types'

const Provider = process.env.PROVIDER_LESS_MODE ? Fragment : ProviderOrig

const useCommitCount = () => {
  const commitCountRef = useRef(1)
  useEffect(() => {
    commitCountRef.current += 1
  })
  return commitCountRef.current
}

it('new atomFamily impl', async () => {
  const myFamily = atomFamily((param) => atom(param))

  const Displayer: React.FC<{ index: string }> = ({ index }) => {
    const [count] = useAtom(myFamily(index))
    return <div>count: {count}</div>
  }
  const { findByText } = render(
    <Provider>
      <Displayer index={'a'} />
    </Provider>
  )

  await findByText('count: a')
})

it('primitive atomFamily returns same reference for same parameters', async () => {
  const myFamily = atomFamily<number, { num: number }>((num) => atom({ num }))
  expect(myFamily(0)).toEqual(myFamily(0))
  expect(myFamily(0)).not.toEqual(myFamily(1))
  expect(myFamily(1)).not.toEqual(myFamily(0))
})

it('read-only derived atomFamily returns same reference for same parameters', async () => {
  const arrayAtom = atom([0])
  const myFamily = atomFamily<number, number>((num) =>
    atom((get) => get(arrayAtom)[num])
  )
  expect(myFamily(0)).toEqual(myFamily(0))
  expect(myFamily(0)).not.toEqual(myFamily(1))
  expect(myFamily(1)).not.toEqual(myFamily(0))
})

it('removed atom creates a new reference', async () => {
  const bigAtom = atom([0])
  const myFamily = atomFamily<number, number>((num) =>
    atom((get) => get(bigAtom)[num])
  )

  const savedReference = myFamily(0)

  expect(savedReference).toEqual(myFamily(0))

  myFamily.remove(0)

  const newReference = myFamily(0)

  expect(savedReference).not.toEqual(newReference)

  myFamily.remove(1337)

  expect(myFamily(0)).toEqual(newReference)
})

it('primitive atomFamily initialized with props', async () => {
  const myFamily = atomFamily((param: number) => atom(param))

  const Displayer: React.FC<{ index: number }> = ({ index }) => {
    const [count, setCount] = useAtom(myFamily(index))
    return (
      <div>
        count: {count}
        <button onClick={() => setCount((c) => c + 10)}>button</button>
      </div>
    )
  }

  const Parent: React.FC = () => {
    const [index, setIndex] = useState(1)

    return (
      <div>
        <button onClick={() => setIndex((i) => i + 1)}>increment</button>
        <Displayer index={index} />
      </div>
    )
  }

  const { findByText, getByText } = render(
    <Provider>
      <Parent />
    </Provider>
  )

  await findByText('count: 1')

  fireEvent.click(getByText('button'))
  await findByText('count: 11')

  fireEvent.click(getByText('increment'))
  await findByText('count: 2')

  fireEvent.click(getByText('button'))
  await findByText('count: 12')
})

it('derived atomFamily functionality as usual', async () => {
  const arrayAtom = atom([0, 0, 0])

  const myFamily = atomFamily<number, number, SetStateAction<number>>((param) =>
    atom(
      (get) => get(arrayAtom)[param],
      (_, set, update) => {
        set(arrayAtom, (oldArray) => {
          if (typeof oldArray[param] === 'undefined') return oldArray

          const newValue =
            typeof update === 'function' ? update(oldArray[param]) : update

          const newArray = [
            ...oldArray.slice(0, param),
            newValue,
            ...oldArray.slice(param + 1),
          ]

          return newArray
        })
      }
    )
  )

  const Displayer: React.FC<{
    index: number
    countAtom: WritableAtom<number, SetStateAction<number>>
  }> = ({ index, countAtom }) => {
    const [count, setCount] = useAtom(countAtom)
    return (
      <div>
        index: {index}, count: {count}
        <button onClick={() => setCount((oldValue) => oldValue + 1)}>
          increment #{index}
        </button>
      </div>
    )
  }

  const indicesAtom = atom((get) => [...new Array(get(arrayAtom).length)])

  const Parent: React.FC = () => {
    const [indices] = useAtom(indicesAtom)

    return (
      <div>
        {indices.map((_, index) => (
          <Displayer key={index} index={index} countAtom={myFamily(index)} />
        ))}
      </div>
    )
  }

  const { getByText } = render(
    <Provider>
      <Parent />
    </Provider>
  )

  await waitFor(() => {
    getByText('index: 0, count: 0')
    getByText('index: 1, count: 0')
    getByText('index: 2, count: 0')
  })

  fireEvent.click(getByText('increment #1'))
  await waitFor(() => {
    getByText('index: 0, count: 0')
    getByText('index: 1, count: 1')
    getByText('index: 2, count: 0')
  })

  fireEvent.click(getByText('increment #0'))
  await waitFor(() => {
    getByText('index: 0, count: 1')
    getByText('index: 1, count: 1')
    getByText('index: 2, count: 0')
  })

  fireEvent.click(getByText('increment #2'))
  await waitFor(() => {
    getByText('index: 0, count: 1')
    getByText('index: 1, count: 1')
    getByText('index: 2, count: 1')
  })
})

it('custom equality function work', async () => {
  const bigAtom = atom([0])

  const badFamily = atomFamily<{ index: number }, number>((num) =>
    atom((get) => get(bigAtom)[num.index])
  )

  const goodFamily = atomFamily<{ index: number }, number>(
    (num) => atom((get) => get(bigAtom)[num.index]),
    (l, r) => l.index === r.index
  )

  expect(badFamily({ index: 0 })).not.toEqual(badFamily({ index: 0 }))
  expect(badFamily({ index: 0 })).not.toEqual(badFamily({ index: 0 }))

  expect(goodFamily({ index: 0 })).toEqual(goodFamily({ index: 0 }))
  expect(goodFamily({ index: 0 })).not.toEqual(goodFamily({ index: 1 }))
})

it('a derived atom from an async atomFamily (#351)', async () => {
  const countAtom = atom(1)
  const getAsyncAtom = atomFamily((n: number) =>
    atom(async () => {
      await new Promise((r) => setTimeout(r, 1))
      return n + 10
    })
  )
  const derivedAtom = atom((get) => get(getAsyncAtom(get(countAtom))))

  const Counter: React.FC = () => {
    const [, setCount] = useAtom(countAtom)
    const [derived] = useAtom(derivedAtom)
    return (
      <>
        <div>
          derived: {derived}, commits: {useCommitCount()}
        </div>
        <button onClick={() => setCount((c) => c + 1)}>button</button>
      </>
    )
  }

  const { getByText, findByText } = render(
    <StrictMode>
      <Provider>
        <Suspense fallback="loading">
          <Counter />
        </Suspense>
      </Provider>
    </StrictMode>
  )

  await findByText('loading')
  await findByText('derived: 11, commits: 1')

  fireEvent.click(getByText('button'))
  await findByText('loading')
  await findByText('derived: 12, commits: 2')

  fireEvent.click(getByText('button'))
  await findByText('loading')
  await findByText('derived: 13, commits: 3')
})
