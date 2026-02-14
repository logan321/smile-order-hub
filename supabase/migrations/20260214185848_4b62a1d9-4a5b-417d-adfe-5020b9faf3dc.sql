
ALTER TABLE public.template_zones
ADD COLUMN path_data jsonb DEFAULT NULL;

COMMENT ON COLUMN public.template_zones.path_data IS 'Array of {x,y} points (percentages) defining a custom polygon contour for the zone. When present, used as clipPath instead of rectangle.';
