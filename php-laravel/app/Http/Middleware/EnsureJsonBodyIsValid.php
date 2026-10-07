<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\BadRequestHttpException;

/** Laravel reads a malformed JSON body as an empty one; the contract answers 400. */
class EnsureJsonBodyIsValid
{
    public function handle(Request $request, Closure $next): Response
    {
        $body = $request->getContent();

        if ($request->isJson() && $body !== '' && ! json_validate($body)) {
            throw new BadRequestHttpException('The request body is not valid JSON');
        }

        return $next($request);
    }
}
