import {Http, Headers} from 'angular2/http';
import {Injectable} from 'angular2/core';
import {FunctionInfo} from './function-info';
import {VfsObject} from './vfs-object';
import {ScmInfo} from './scm-info';
import {PassthroughInfo} from './passthrough-info';
import {IFunctionsService} from './ifunctions.service';

@Injectable()
export class FunctionsService implements IFunctionsService {
    private scmInfo: ScmInfo;
    constructor(private _http: Http) { }

    initializeUser() {
        return this._http.post('api/init', '', { headers: this.getHeaders() })
            .map<ScmInfo>(r => {
                this.scmInfo = r.json();
                return this.scmInfo;
            });
    }

    getFunctions() {
        var body: PassthroughInfo = {
            httpMethod: 'GET',
            url: 'https://' + this.scmInfo.scm_url + '/api/functions'
        };
        return this._http.post('api/passthrough', JSON.stringify(body), { headers: this.getHeaders() })
            .map<FunctionInfo[]>(r => r.json());
    }

    getFunctionContent(functionInfo: FunctionInfo) {
        var body: PassthroughInfo = {
            httpMethod: 'GET',
            url: functionInfo.href
        };
        return this._http.post('api/passthrough', JSON.stringify(body), { headers: this.getHeaders() })
            .map<any>(r => {
                return {
                    files: r.json(),
                    functionInfo: functionInfo
                };
            });
    }

    getFileContent(file: VfsObject) {
        var body: PassthroughInfo = {
            httpMethod: 'GET',
            url: file.href
        };
        return this._http.post('api/passthrough', JSON.stringify(body), { headers: this.getHeaders() })
            .map<string>(r => r.text());
    }

    private getHeaders(): Headers {
        var headers = new Headers();
        headers.append('Content-Type', 'application/json');
        return headers;
    }
}