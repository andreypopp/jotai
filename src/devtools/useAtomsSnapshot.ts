import { useCallback, useContext } from 'react'
import { SECRET_INTERNAL_getStoreContext as getStoreContext } from 'jotai'
import { State, subscribeAtom } from '../core/vanilla'
import { RegisteredAtomsContext } from '../core/contexts'
import { useMutableSource } from '../core/useMutableSource'

export function useAtomsSnapshot() {
  const StoreContext = getStoreContext()
  const [mutableSource] = useContext(StoreContext)
  const atoms = useContext(RegisteredAtomsContext)

  const subscribe = useCallback(
    (state: State, callback: () => void) => {
      // FIXME we don't need to resubscribe, just need to subscribe for new one
      const unsubs = atoms.map((atom) => subscribeAtom(state, atom, callback))
      return () => {
        unsubs.forEach((unsub) => unsub())
      }
    },
    [atoms]
  )
  const state = useMutableSource(mutableSource, getState, subscribe)

  // todo: make this a map and type the state
  return [atoms, state]
}

const getState = (state: State) => ({ ...state }) // shallow copy
