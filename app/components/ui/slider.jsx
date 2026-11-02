import { Slider as SliderPrimitive } from "@base-ui/react/slider";

import { cn } from "@/lib/utils";

function Slider({
  "aria-label": ariaLabel,
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  ...props
}) {
  const currentValue = value ?? defaultValue ?? min;
  const values = Array.isArray(currentValue) ? currentValue : [currentValue];

  return (
    <SliderPrimitive.Root
      aria-label={ariaLabel}
      className={cn("data-horizontal:w-full data-vertical:h-full", className)}
      data-slot="slider"
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      thumbAlignment="edge"
      {...props}
    >
      <SliderPrimitive.Control className="relative flex w-full touch-none items-center select-none data-disabled:opacity-50 data-vertical:h-full data-vertical:min-h-40 data-vertical:w-auto data-vertical:flex-col">
        <SliderPrimitive.Track
          data-slot="slider-track"
          data-corner-shape="round"
          className="relative grow overflow-hidden rounded-full bg-input/90 select-none data-horizontal:h-2 data-horizontal:w-full data-vertical:h-full data-vertical:w-2"
        >
          <SliderPrimitive.Indicator
            data-slot="slider-range"
            data-corner-shape="round"
            className="bg-primary select-none data-horizontal:h-full data-vertical:w-full"
          />
        </SliderPrimitive.Track>
        {Array.from({ length: values.length }, (_, index) => (
          <SliderPrimitive.Thumb
            data-slot="slider-thumb"
            data-corner-shape="round"
            index={index}
            getAriaLabel={
              typeof ariaLabel === "string" ? () => ariaLabel : undefined
            }
            key={index}
            className="block h-4 w-6 shrink-0 rounded-full bg-white shadow-md ring-1 ring-black/10 transition-[color,box-shadow,background-color] select-none not-dark:bg-clip-padding hover:ring-4 hover:ring-ring/30 has-focus-visible:ring-4 has-focus-visible:ring-ring/30 [&>input]:outline-none data-disabled:pointer-events-none data-vertical:h-6 data-vertical:w-4"
          />
        ))}
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  );
}

export { Slider };
