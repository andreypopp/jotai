# Large Objects

> All of the examples and descriptions below are based on this [codesandbox](https://codesandbox.io/s/zealous-sun-f2qnl?file=/src/App.tsx), so it will give you a better understanding if you check it out along these examples.

Sometimes we have big data we need to keep into atoms, we may need to change that data in some levels, or we need to use part of that data, but we can't listen to all these changes or use all that data for just a specific part.

consider this example.

```jsx
const initialData = {
  people: [
    {
      name: 'Luke Skywalker',
      information: { height: 172 },
      siblings: ['John Skywalker', 'Doe Skywalker'],
    },
    {
      name: 'C-3PO',
      information: { height: 167 },
      siblings: ['John Doe', 'Doe John'],
    },
  ],
  films: [
    {
      title: 'A New Hope',
      planets: ['Tatooine', 'Alderaan'],
    },
    {
      title: 'The Empire Strikes Back',
      planets: ['Hoth'],
    },
  ],
  info: {
    tags: ['People', 'Films', 'Planets', 'Titles'],
  },
}
```

## `focusAtom`

> `focusAtom` creates a new atom, based on the focus that you pass to it. [jotai/optics](../api/optics.md#focusatom)

We use this utility to focus an atom and create an atom of a specific part of the data. For example we may need to consume the people property of the above data, Here's how we do it.

```jsx
import { atom } from 'jotai'
import { focusAtom } from 'jotai/optics'

const dataAtom = atom(initialData)

const peopleAtom = focusAtom(dataAtom, (optic) => optic.prop('people'))
```

`focusAtom` returns `WritableAtom` which means it's possible to change the `peopleAtom` data.

If we change the `film` property of the above data example, the `peopleAtom` won't cause us a re-render, so that's one of the points of using `focusAtom`.

## `splitAtom`

> The `splitAtom` utility is useful, when you want to get an atom for each element in a list. [jotai/utils](../api/utils.md#splitatom)

We use this utility for atoms that return arrays as their values, for example the `peopleAtom` we made above returns the people property array, so we can return an atom for each item of that array. If the array atom is writable, `splitAtom` returned atoms are going to be writable, if the array atom is read-only, items atoms are going to be read-only too.

```jsx
import { splitAtom } from 'jotai/utils'

const peopleAtomsAtom = splitAtom(peopleAtom)
```

And that's how we use it in components.

```jsx
const People = () => {
  const [peopleAtoms] = useAtom(peopleAtomsAtom)
  return (
    <div>
      {peopleAtoms.map((personAtom) => (
        <Person personAtom={personAtom} key={`${personAtom}`} />
      ))}
    </div>
  )
}
```

## `selectAtom`

> This function creates a derived atom whose value is a function of the original atom's value. [jotai/utils](../api/utils.md#selectatom)

This utility is similar to `focusAtom`, but we use it when we have a read-only atom to select part of it, and it always returns a read-only atom.

Assume we want to consume the info data, and its data is always unchangeable, so we can make a read-only atom from it and select that created atom.

```jsx
// first we create a read-only atom based on initialData.info
const readOnlyInfoAtom = atom((get) => get(dataAtom).info)
```

Then we can going to consume it in our component:

```jsx
import { atom, useAtom } from 'jotai'
import { selectAtom, splitAtom } from 'jotai/utils'

const Tags: React.FC = () => {
  const tagsAtom = selectAtom(readOnlyInfoAtom, (s) => s.tags)
  const tagsAtomsAtom = splitAtom(tagsAtom)
  const [tagAtoms] = useAtom(tagsAtomsAtom)
  return (
    <div>
      {tagAtoms.map((tagAtom) => (
        <Tag key={`${tagAtom}`} tagAtom={tagAtom} />
      ))}
    </div>
  )
}
```
