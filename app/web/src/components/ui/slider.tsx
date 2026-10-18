import * as SliderPrimitive from '@radix-ui/react-slider'
import type { ComponentPropsWithoutRef } from 'react'

export function Slider(props: ComponentPropsWithoutRef<typeof SliderPrimitive.Root> & { label: string }) {
  const { label, ...rest } = props
  return (
    <SliderPrimitive.Root className="slider" {...rest}>
      <SliderPrimitive.Track className="track">
        <SliderPrimitive.Range className="range" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb className="thumb" aria-label={label} />
    </SliderPrimitive.Root>
  )
}
